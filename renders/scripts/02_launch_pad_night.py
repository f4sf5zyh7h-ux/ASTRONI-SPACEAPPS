import sys
sys.path.insert(0, r'C:\ASTRONI SPACEAPPS\renders\scripts')
from lib import *

scn = reset()
space_world(scn, base=(0.006, 0.009, 0.022), nebula=0.0, star_gain=30.0)
imp('launch-pad')
z = 9.0
for name, h in [('engine-m-booster', 2.0), ('tank-m-long', 7.9), ('tank-m-short', 3.2), ('heat-shield-m', 0.4), ('capsule-2', 3.5)]:
    imp(name, loc=(0, 0, z)); z += h
imp('fuel-truck', loc=(-38, 24.4, 0)); imp('fire-truck', loc=(-38, 13.75, 0)); imp('command-truck', loc=(-38, 3.0, 0)); imp('crew-van', loc=(-38, -8.0, 0))
imp('crawler-transporter', loc=(0, 57, 0), rot=(0, 0, math.radians(-90)))
for x, y in ((-24, 28), (24, 28), (24, -28), (-24, -28)):
    spot(scn, (x, y, 24.5), (0, 0, 15), 750000, deg=30, color=(1.0, 0.9, 0.75))
spot(scn, (-30, 10, 12), (-38, 8, 0), 60000, deg=60, color=(1.0, 0.85, 0.6))
sun(scn, (0.4, -0.6, -0.4), strength=0.12, color=(0.6, 0.7, 1.0))
point(scn, (0, 0, 8), 8000, color=(1.0, 0.6, 0.3), r=2.0)
camera(scn, (-72.0, 14.0, 7.0), (-4.0, 4.0, 13.0), lens=30)
fix_materials(); settings(scn, samples=128, exposure=1.3)
go(scn, '02-launch-pad-night')
