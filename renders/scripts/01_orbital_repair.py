import sys
sys.path.insert(0, r'C:\ASTRONI SPACEAPPS\renders\scripts')
from lib import *

scn = reset()
space_world(scn)
sat, sn = imp('satellite-aurora7', rot=(0, 0, math.radians(20)))
cargo, cn = imp('cargo-module-m', loc=(11.5, -1.0, -0.5))
imp('docking-port-s', loc=(0, 0, 3.0), parent=cargo)
for s in (1, -1):
    imp('solar-panel', loc=(0, s*1.25, 1.6), rot=(0, 0, math.radians(90*s)), parent=cargo)
arm, an = imp('robotic-arm', loc=(-1.25, 0, 1.6), rot=(0, 0, math.pi), parent=cargo)
pose(an['shoulder'], 'Z', 18); pose(an['elbow'], 'Z', -48); pose(an['wrist_pitch'], 'Z', -10)
for j in ('jaw_1', 'jaw_2', 'jaw_3'): pose(an[j], 'Z', -18)
panel, pn = imp('replacement-panel', loc=(0.387, 0, -0.25), rot=(0, 0, math.pi), parent=an['grip_point'])
E = earth(R=450.0, center=(60, 260, -520))
split_sun(scn, (0.45, 0.75, -0.45), 5.0, (E, bpy.data.objects['Atmosphere']))
camera(scn, (17.0, -21.0, 9.5), (3.0, 0.5, 3.0), lens=30)
fix_materials(); settings(scn, samples=128)
go(scn, '01-orbital-repair')
