@echo off
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python "C:\ASTRONI SPACEAPPS\renders\scripts\01_orbital_repair.py" -- preview > "C:\ASTRONI SPACEAPPS\renders\scripts\01_orbital_repair_preview.log" 2>&1
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python "C:\ASTRONI SPACEAPPS\renders\scripts\04_orbit_craft.py" -- preview > "C:\ASTRONI SPACEAPPS\renders\scripts\04_orbit_craft_preview.log" 2>&1
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python "C:\ASTRONI SPACEAPPS\renders\scripts\02_launch_pad_night.py" -- preview > "C:\ASTRONI SPACEAPPS\renders\scripts\02_launch_pad_night_preview.log" 2>&1
echo done > "C:\ASTRONI SPACEAPPS\renders\scripts\partial.done"
