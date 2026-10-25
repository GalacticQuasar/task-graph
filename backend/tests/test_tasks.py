def titles(client, view="actionable", **params):
    r = client.get("/api/tasks", params={"view": view, **params})
    assert r.status_code == 200
    return [t["title"] for t in r.json()]


def test_only_chain_head_is_actionable(client, chain):
    assert titles(client) == ["work out"]
    assert titles(client, "all") == ["work out", "shave", "shower", "trim nails"]


def test_completing_head_promotes_successor(client, chain):
    client.post(f"/api/tasks/{chain[0]}/complete")
    assert titles(client) == ["shave"]
    assert titles(client, "completed") == ["work out"]


def test_uncomplete_demotes_successor(client, chain):
    client.post(f"/api/tasks/{chain[0]}/complete")
    client.post(f"/api/tasks/{chain[0]}/uncomplete")
    assert titles(client) == ["work out"]


def test_early_completion_surfaces_its_children(client, chain):
    # Sequence, not dependency: "shower" can be done before "shave".
    client.post(f"/api/tasks/{chain[2]}/complete")
    assert titles(client) == ["work out", "trim nails"]


def test_forks_promote_all_children(client):
    root = client.post("/api/tasks", json={"title": "review lecture"}).json()["id"]
    client.post("/api/tasks", json={"title": "homework", "parent_id": root})
    client.post("/api/tasks", json={"title": "flashcards", "parent_id": root})
    client.post(f"/api/tasks/{root}/complete")
    assert titles(client) == ["homework", "flashcards"]


def test_delete_splices_children_to_grandparent(client, chain):
    assert client.delete(f"/api/tasks/{chain[1]}").status_code == 204
    shower = client.get(f"/api/tasks/{chain[2]}").json()
    assert shower["parent_id"] == chain[0]
    client.post(f"/api/tasks/{chain[0]}/complete")
    assert titles(client) == ["shower"]


def test_delete_root_makes_children_roots(client, chain):
    client.delete(f"/api/tasks/{chain[0]}")
    assert client.get(f"/api/tasks/{chain[1]}").json()["parent_id"] is None
    assert titles(client) == ["shave"]


def test_reparent_to_self_rejected(client, chain):
    r = client.patch(f"/api/tasks/{chain[0]}", json={"parent_id": chain[0]})
    assert r.status_code == 409


def test_reparent_under_descendant_rejected(client, chain):
    r = client.patch(f"/api/tasks/{chain[0]}", json={"parent_id": chain[3]})
    assert r.status_code == 409
    assert client.get(f"/api/tasks/{chain[0]}").json()["parent_id"] is None


def test_reparent_and_detach(client, chain):
    other = client.post("/api/tasks", json={"title": "email advisor"}).json()["id"]
    r = client.patch(f"/api/tasks/{chain[3]}", json={"parent_id": other})
    assert r.status_code == 200 and r.json()["parent_id"] == other
    r = client.patch(f"/api/tasks/{chain[3]}", json={"parent_id": None})
    assert r.json()["parent_id"] is None
    assert titles(client) == ["work out", "email advisor", "trim nails"]


def test_unknown_parent_rejected(client):
    assert client.post("/api/tasks", json={"title": "x", "parent_id": 999}).status_code == 422


def test_patch_without_parent_keeps_parent(client, chain):
    r = client.patch(f"/api/tasks/{chain[1]}", json={"title": "shave face"})
    assert r.json()["parent_id"] == chain[0]


def test_actionable_sorted_by_due_date_nulls_last(client):
    client.post("/api/tasks", json={"title": "no date"})
    client.post("/api/tasks", json={"title": "later", "due_date": "2026-12-01"})
    client.post("/api/tasks", json={"title": "sooner", "due_date": "2026-11-01"})
    assert titles(client) == ["sooner", "later", "no date"]


def test_groups_filter_and_inbox(client):
    school = client.post("/api/groups", json={"name": "school"}).json()["id"]
    career = client.post("/api/groups", json={"name": "career"}).json()["id"]
    email = client.post(
        "/api/tasks", json={"title": "email advisor", "group_ids": [career]}
    ).json()["id"]
    # Edges cross groups freely.
    client.post(
        "/api/tasks", json={"title": "register", "parent_id": email, "group_ids": [school]}
    )
    client.post("/api/tasks", json={"title": "buy milk"})

    assert titles(client, group=career) == ["email advisor"]
    assert titles(client, group=school) == []
    assert titles(client, "all", group=school) == ["register"]
    assert titles(client, "inbox") == ["buy milk"]


def test_set_and_clear_groups(client):
    g = client.post("/api/groups", json={"name": "health"}).json()["id"]
    t = client.post("/api/tasks", json={"title": "work out"}).json()["id"]
    assert client.patch(f"/api/tasks/{t}", json={"group_ids": [g]}).json()["group_ids"] == [g]
    assert client.patch(f"/api/tasks/{t}", json={"group_ids": []}).json()["group_ids"] == []
    assert client.patch(f"/api/tasks/{t}", json={"group_ids": [42]}).status_code == 422


def test_deleting_group_untags_tasks(client):
    g = client.post("/api/groups", json={"name": "health"}).json()["id"]
    t = client.post("/api/tasks", json={"title": "work out", "group_ids": [g]}).json()["id"]
    assert client.delete(f"/api/groups/{g}").status_code == 204
    assert client.get(f"/api/tasks/{t}").json()["group_ids"] == []


def test_duplicate_group_name_conflicts(client):
    client.post("/api/groups", json={"name": "school"})
    assert client.post("/api/groups", json={"name": "school"}).status_code == 409
