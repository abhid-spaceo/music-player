"""Formats verification JSON for the terminal. Reads stdin, takes a mode arg."""
import json, sys

mode = sys.argv[1]
d = json.load(sys.stdin)

if mode == "first-outcome":
    r = d["data"][0]
    print(r.get("videoId", "-"), r["status"])
elif mode == "meta":
    print("  meta:", d["meta"])
elif mode == "outcomes":
    for r in d["data"]:
        line = "  {:<11} {:<54} {}".format(
            r["status"], r["input"][:52], r.get("reason", ""))
        print(line)
    print("  meta:", d["meta"])
elif mode == "outcome-ids":
    for r in d["data"]:
        print("  {:<11} {}".format(r["status"], r.get("videoId")))
    print("  meta:", d["meta"])
elif mode == "meta-key":
    print(d["meta"][sys.argv[2]])
elif mode == "availability":
    wanted = set(sys.argv[2:])
    for t in d["data"]:
        if t["youtube_id"] in wanted:
            print("  {} -> {}".format(t["youtube_id"], t["availability"]))
elif mode == "id-for":
    for t in d["data"]:
        if t["youtube_id"] == sys.argv[2]:
            print(t["id"]); break
elif mode == "data":
    print("  ", json.dumps(d["data"]))
elif mode == "page":
    print("  page meta:", d["meta"]); print("  rows:", len(d["data"]))
elif mode == "stub":
    print("  stub saw: calls={} batches={}".format(d["calls"], d["batches"]))
