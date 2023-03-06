
/**
 * areaRectanglesCount counts rectangles count need to cover the area
 * @param tlc {L.Point} top left corner
 * @param brc {L.Point} top right corner
 * @param w {number} rectangle width
 * @param h {number} rectangle height
 */
export function areaRectanglesCount(tlc, brc, w, h) {
    return [Math.ceil((brc.x - tlc.x) / w), Math.ceil((brc.y - tlc.y) / h)]
}
/**
 * coverAreaWithRectangles returns array of rectangles that cover the area
 * @param tlc {L.Point} top left corner
 * @param brc {L.Point} bottom right corner
 * @param w {number}  width in points
 * @param h {number}  height in points
 */
export function coverAreaWithRectangles(tlc, brc, w, h) {

    let rects = []

    let [wPages, hPages] = areaRectanglesCount(tlc, brc, w, h)
    let startX = tlc.x
    let startY = tlc.y

    // cover area with rectangles
    for (let i = 0; i < hPages; i++) {
        for (let j = 0; j < wPages; j++) {
            let x = startX + j * w
            let y = startY + i * h
            rects.push(new Rectangle(L.point(x, y), L.point(x + w, y + h)))
        }
    }
    return rects
}

// coverLineWithRectangle and coverLineWithRectangles functions originally was written by Herman Sletmoen <https://github.com/hersle/leaflet-route-print>

export function coverLineWithRectangles(l, w, h, mix) {
    let rects = [];
    let intersections = [];
    let i1 = 0;
    while (true) {
        let [rect, i2, intersection, dist] = coverLineWithRectangle(l, w, h, i1);
        if (mix) {
            let [recthw, i2hw, intersectionhw, disthw] = coverLineWithRectangle(l, h, w, i1);
            rect.rotated = false;
            if (disthw > dist) {
                [rect, i2, intersection, dist] = [recthw, i2hw, intersectionhw, disthw];
                rect.rotated = true;
            }
        }
        rects.push(rect);
        if (intersection === undefined) {
            break;
        }
        intersections.push(intersection);
        l.splice(i2, 0, intersection); // divide the segment TODO: don't modify input array
        i1 = i2;
    }
    return [rects, intersections];
}

function coverLineWithRectangle(l, w, h, i1) {
    let rect = new Rectangle(l[i1], l[i1]);
    let segment;
    let intersection = undefined;
    let dist = 0;
    let i = 0;
    for (i = i1+1; i < l.length && intersection === undefined; i++) {
        let grect = rect.extend(l[i]);
        segment = new Segment(l[i-1], l[i]);
        if (grect.isSmallerThan(w, h)) { // whole segment fits in rectangle [w,h]
            rect = grect;
        } else { // segment must be divided to fit in rectangle [w,h]
            [rect, intersection] = rect.extendBounded(segment, w, h); // create rectangle as big as possible in the direction of the segment
            segment = new Segment(l[i-1], intersection);
        }
        dist += segment.length();
    }
    rect = (new Rectangle(L.point(0, 0), L.point(w, h))).center(rect.middle);
    return [rect, i, intersection, dist];
}

export class Rectangle {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }

    get xmin() { return this.min.x; }
    get ymin() { return this.min.y; }
    get xmax() { return this.max.x; }
    get ymax() { return this.max.y; }

    get corner1() { return L.point(this.xmin, this.ymin); }
    get corner2() { return L.point(this.xmax, this.ymin); }
    get corner3() { return L.point(this.xmax, this.ymax); }
    get corner4() { return L.point(this.xmin, this.ymax); }
    get topleft() { return this.corner1; }
    get bottomright() { return this.corner3; }

    get middle() { return this.min.add(this.max).divideBy(2); }

    get size() { return this.max.subtract(this.min); }
    get width() { return this.size.x; }
    get height() { return this.size.y; }

    center(c) {
        let d = c.subtract(this.middle);
        return new Rectangle(this.min.add(d), this.max.add(d));
    }

    extend(p) {
        let min = L.point(Math.min(this.xmin, p.x), Math.min(this.ymin, p.y));
        let max = L.point(Math.max(this.xmax, p.x), Math.max(this.ymax, p.y));
        return new Rectangle(min, max);
    }

    extendToSquare() {
        let d = Math.abs(this.size.x - this.size.y)
        let offset = d / 2
        let min = L.point(this.xmin, this.ymin)
        let max = L.point(this.xmax, this.ymax)
        if (this.size.x > this.size.y) {
            min.y -= offset
            max.y += offset
        } else {
            min.x -= offset
            max.x += offset
        }
        return new Rectangle(min, max);
    }

    extendBounded(s, w, h) {
        let d = s.displacement;
        let maxRect;
        if (d.x >= 0 && d.y >= 0) { // north-east quadrant
            maxRect = new Rectangle(L.point(this.xmin, this.ymin), L.point(this.xmin+w, this.ymin+h));
        } else if (d.x < 0 && d.y >= 0) { // north-west quadrant
            maxRect = new Rectangle(L.point(this.xmax-w, this.ymin), L.point(this.xmax, this.ymin+h));
        } else if (d.x < 0 && d.y < 0) { // south-west quadrant
            maxRect = new Rectangle(L.point(this.xmax-w, this.ymax-h), L.point(this.xmax, this.ymax));
        } else if (d.x > 0 && d.y < 0) { // south-east quadrant
            maxRect = new Rectangle(L.point(this.xmin, this.ymax-h), L.point(this.xmin+w, this.ymax));
        }
        let intersection = maxRect.intersection(s);
        console.assert(intersection !== undefined, "segment-rectangle intersection test failed");
        return [this.extend(maxRect.intersection(s)), intersection];
    }

    pad(p) {
        return new Rectangle(this.min.subtract(L.point(p, p)), this.max.add(L.point(p,p)));
    }

    scale(scale) {
        return new Rectangle(this.min.multiplyBy(scale), this.max.multiplyBy(scale));
    }

    isSmallerThan(w, h) {
        return this.size.x <= w && this.size.y <= h;
    }

    intersection(s) {
        let s1 = new Segment(this.corner1, this.corner2);
        let s2 = new Segment(this.corner2, this.corner3);
        let s3 = new Segment(this.corner3, this.corner4);
        let s4 = new Segment(this.corner4, this.corner1);
        let ss = [s1, s2, s3, s4];
        for (let side of ss) {
            let p = s.intersection(side);
            // don't register intersection if it is in the beginning corner (TODO: why not?)
            if (p !== undefined && !(p.x == s1.p1.x && p.y == s1.p1.y)) {
                return p; // intersect with a side
            }
        }
        return undefined; // no intersection
    }
}

class Segment {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
    }

    get displacement() { return this.p2.subtract(this.p1); }

    intersection(s2) {
        // see https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Given_two_points_on_each_line_segment
        let s1 = this;
        let x1 = s1.p1.x, y1 = s1.p1.y, x2 = s1.p2.x, y2 = s1.p2.y; // segment 1
        let x3 = s2.p1.x, y3 = s2.p1.y, x4 = s2.p2.x, y4 = s2.p2.y; // segment 2
        let d = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4);
        let t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / d;
        let u = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / d;
        if (d !== 0 && t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            var x = x1 + t*(x2-x1);
            var y = y1 + t*(y2-y1);
            return L.point(x, y);
        } else {
            return undefined
        }
    }

    length() {
        let dx = this.p2.x - this.p1.x;
        let dy = this.p2.y - this.p1.y;
        return (dx**2 + dy**2)**0.5;
    }
}


