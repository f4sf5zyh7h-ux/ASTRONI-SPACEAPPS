@echo off
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python "C:\ASTRONI SPACEAPPS\renders\scripts\01_orbital_repair.py" -- %1 > "C:\ASTRONI SPACEAPPS\renders\scripts\01_orbital_repair_%1.log" 2>&1
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python "C:\ASTRONI SPACEAPPS\renders\scripts\02_launch_pad_night.py" -- %1 > "C:\ASTRONI SPACEAPPS\renders\scripts\02_launch_pad_night_%1.log" 2>&1
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python "C:\ASTRONI SPACEAPPS\renders\scripts\03_factory.py" -- %1 > "C:\ASTRONI SPACEAPPS\renders\scripts\03_factory_%1.log" 2>&1
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python "C:\ASTRONI SPACEAPPS\renders\scripts\04_orbit_craft.py" -- %1 > "C:\ASTRONI SPACEAPPS\renders\scripts\04_orbit_craft_%1.log" 2>&1
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --factory-startup --python "C:\ASTRONI SPACEAPPS\renders\scripts\05_catalog.py" -- %1 > "C:\ASTRONI SPACEAPPS\renders\scripts\05_catalog_%1.log" 2>&1
echo done > "C:\ASTRONI SPACEAPPS\renders\scripts\%1.done"
