import os, json, glob, shutil, urllib.parse
history_dir = os.path.expanduser("~/.config/Code/User/History")
project_dir = "Proj_Mythos"

print("Starting recovery scan...")
for entry_file in glob.glob(os.path.join(history_dir, "*", "entries.json")):
    with open(entry_file, 'r') as f:
        try:
            data = json.load(f)
            res = urllib.parse.unquote(data.get("resource", ""))
            if project_dir in res:
                print(f"Found project file: {res}")
                # extract path
                if res.startswith("file://"):
                    path = res[7:]
                elif res.startswith("vscode-remote://"):
                    path = res.split(project_dir)[1]
                    path = os.path.join(os.path.expanduser("~/Projects/Proj_Mythos"), path.lstrip('/'))
                else:
                    path = res.split(project_dir)[1]
                    path = os.path.join(os.path.expanduser("~/Projects/Proj_Mythos"), path.lstrip('/'))
                
                entries = data.get("entries", [])
                if entries:
                    latest = max(entries, key=lambda x: x.get("timestamp", 0))
                    src = os.path.join(os.path.dirname(entry_file), latest.get("id", ""))
                    if os.path.exists(src):
                        print(f"Recovering {path} from {src}")
                        os.makedirs(os.path.dirname(path), exist_ok=True)
                        shutil.copy2(src, path)
        except Exception as e:
            pass
print("Done.")
