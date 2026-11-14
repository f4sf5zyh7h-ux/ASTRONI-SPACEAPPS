
import bpy, sys, json, mathutils
argv = sys.argv[sys.argv.index('--')+1:]
src, dst = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=src)
info = []
mn = [1e9]*3; mx = [-1e9]*3
for o in bpy.data.objects:
    if o.type == 'MESH':
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            for i in range(3): mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
    info.append((o.name, o.type, o.parent.name if o.parent else None, [round(v,3) for v in o.matrix_world.translation], [m.name for m in o.data.materials] if o.type=='MESH' else None))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_yup=True, export_apply=False)
print('RESULT', json.dumps({'objs': info, 'min': mn, 'max': mx, 'scene_unit': bpy.context.scene.unit_settings.scale_length}))
