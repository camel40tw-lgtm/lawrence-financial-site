from PIL import Image, ImageDraw
import sys

try:
    size = 180
    scale = size / 64
    
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    
    mask = Image.new('L', (size, size), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.rounded_rectangle((0, 0, size, size), radius=18*scale, fill=255)
    
    bg = Image.new('RGBA', (size, size))
    for y in range(size):
        for x in range(size):
            progress = (x + y) / (2 * size) 
            r = int(16 + (36 - 16) * progress)
            g = int(41 + (79 - 41) * progress)
            b = int(71 + (131 - 71) * progress)
            bg.putpixel((x, y), (r, g, b, 255))
            
    img.paste(bg, (0, 0), mask)
    
    draw = ImageDraw.Draw(img)
    
    points1 = [(20, 18), (28, 18), (28, 46), (44, 46), (44, 52), (20, 52)]
    points1_scaled = [(x*scale, y*scale) for x, y in points1]
    draw.polygon(points1_scaled, fill=(255, 255, 255, 255))
    
    shape2_mask = Image.new('L', (size, size), 0)
    draw_shape2 = ImageDraw.Draw(shape2_mask)
    x0, y0 = 40*scale, 14*scale
    x1, y1 = 46*scale, 50*scale
    draw_shape2.polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], fill=255)
    
    shape2_layer = Image.new('RGBA', (size, size))
    for y in range(int(y0), int(y1)+1):
        for x in range(int(x0), int(x1)+1):
            if y >= size or x >= size: continue
            progress = ( (x - x0) / max(1, x1 - x0) + (y - y0) / max(1, y1 - y0) ) / 2
            r = int(245 + (217 - 245) * progress)
            g = int(158 + (119 - 158) * progress)
            b = int(11 + (6 - 11) * progress)
            shape2_layer.putpixel((x, y), (r, g, b, 255))
            
    img.paste(shape2_layer, (0, 0), shape2_mask)
    
    final_img_path = r'd:\AI\lawrence_financial_site\images\apple-touch-icon.png'
    img.save(final_img_path)
    print("Apple touch icon created successfully!")

except Exception as e:
    print("Error:", e)
    sys.exit(1)
