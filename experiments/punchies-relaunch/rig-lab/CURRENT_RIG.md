# Current rig experiment

One front-facing face/headguard base and one hair sprite rotate continuously. No directional swaps or mouse-facing handler. Right-hand candidate has a leaner torso/arms and a new royal-blue/cream belt-and-shorts abdomen between the leg connectors and torso.

Removed the extra ankle overlap Graphics pass responsible for the outlined oval. Shoes render below the single leg connector pass.

Candidate leg connector is now the straight convex hull of a large thigh circle and smaller shoe-collar circle. There is no knee or bend. Candidate arms are two overlapping ellipses whose long axes stretch between the existing shoulder/elbow/wrist joints. Marco's arm/leg material is his portrait skin colour; future clothing variants can use the material slot. Left comparison retains original limb shapes. Only rendering changed; saved tuning and the running server are preserved.

Two independent pixel endpoint sets, edited through Tune down / Tune up. Four gaps per set: foot to abdomen, abdomen to torso, torso to head, head to hair. Angles use weight (1 - facingY) / 2, interpolating each gap separately. These are actual scene-pixel gaps before inspection zoom, with no additional angle multiplier. Defaults convert the preceding 0.8/2 multiplier test: down (4,4,5.2,4.4), up (10,10,13,11).

Current abdomen source: assets/abdomen-v6.png. Generated with the built-in image tool using Marco's torso as the art/camera reference and the user's diagram only as an overlap guide. Rounded cloth/anatomy replaces the literal vector diagram; shorts sections are tucked underneath the broad top surface. Exact prompt: ABDOMEN_V6_PROMPT.txt. Saved tuning is unchanged. Draft asset awaits user approval.

Tuning now has independent down, side and up sets. Each gap blends through the side set with smooth angular interpolation; left and right share that set. Tuning autosaves to ../punchies-rig-tuning-draft.json; see TUNING_SAVE.md. Preserve this sibling file during app updates.

Local server reused on 127.0.0.1:5338. No additional server started for this revision. Source syntax checked; endpoint controls and side midpoint visually checked. Browser console checked for runtime errors.



