import sys
sys.path.insert(0, r'C:\ASTRONI SPACEAPPS\renders\scripts')
from lib import *

scn = reset()
space_world(scn)
craft = bpy.data.objects.new('craft', None); scn.collection.objects.link(craft)
craft.rotation_euler = (math.radians(84), math.radians(-6), math.radians(124))
imp('engine-m-vacuum', parent=craft)
imp('tank-m-short', loc=(0, 0, 3.5), parent=craft)
imp('heat-shield-m', loc=(0, 0, 6.7), parent=craft)
imp('capsule-2', loc=(0, 0, 7.1), parent=craft)
for s in (1, -1):
    imp('solar-panel', loc=(s*1.25, 0, 5.1), rot=(0, 0, 0 if s > 0 else math.pi), parent=craft)
for k in range(4):
    a = math.radians(45 + 90*k)
    imp('rcs-block', loc=(1.25*math.cos(a), 1.25*math.sin(a), 6.2), rot=(0, 0, a), parent=craft)
E = earth(R=700.0, center=(-120, 420, -760))
split_sun(scn, (-0.6, 0.65, -0.45), 5.0, (E, bpy.data.objects['Atmosphere']))
camera(scn, (14.0, -20.0, 7.0), (4.0, 2.8, 0.8), lens=38)
fix_materials(); settings(scn, samples=128)
go(scn, '04-orbit-craft')
