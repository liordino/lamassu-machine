const jsfeat = require('jsfeat')
const jpg = require('jpeg-turbo')

module.exports = { 
  findId,
  crop
}

// TODO: move to another module?
function crop(image, regionOfInterest) {
  const pixelSize = 3
  const rowWidth = image.width
  const rawData = image.data

  // const decrompressedImage = 
  //   jpg.decompressSync(
  //     image, 
  //     {
  //       format: jpg.FORMAT_RGB
  //     }
  //   )

  const pixelRows = Array(regionOfInterest.height)

  for (let row = regionOfInterest.y; 
    row < regionOfInterest.y + regionOfInterest.height; 
    row++
  ) {
    const startPosition = 
      (row * rowWidth * pixelSize) 
      + (regionOfInterest.x * pixelSize)

    const endPosition = 
      startPosition 
      + (regionOfInterest.width * pixelSize)

    pixelRows[row - regionOfInterest.y] = 
      rawData.slice(
        startPosition, 
        endPosition
      )
  }

  return Buffer.concat(
    pixelRows, 
    width * pixelSize * regionOfInterest.height
  )
}

function findId(image, width, height) {
  var img_u8 = 
    new jsfeat.matrix_t(
        width, 
        height, 
        jsfeat.U8_t | jsfeat.C1_t
    )
  
    // TODO: If needed, a separated bilateral filter could be tested here (probably faster)
    const kernel_size = 5
    const sigma = 6
    jsfeat.imgproc.gaussian_blur(
        image, 
        img_u8, 
        kernel_size, 
        sigma
    )

  const low_threshold = 32
  const high_threshold = 96
  jsfeat.imgproc.canny(
      img_u8,
      img_u8, 
      low_threshold, 
      high_threshold
  )

  const rho_res = 1
  const theta_res = Math.PI / 540
  const threshold = (height < width ? height : width) * .18
  const houghTransform = 
    jsfeat.imgproc.hough_transform(
        img_u8, 
        rho_res, 
        theta_res, 
        threshold
    )

  const rectangles = 
    findRectangles(
        getLineSegmentsFromHoughTransform(
          houghTransform, 
          canvasWidth, 
          canvasHeight
      ), 
      canvasWidth, 
      canvasHeight,
      ctx
    )
  
  return rectangles
    .map(r => {
      return {
        x: Math.min(r.map(r => r.x)),
        y: Math.max(r.map(r => r.y)),
        width: Math.max(r.map(r => r.x)) - x,
        height: y - Math.min(r.map(r => r.y))
      }
    })
}

function getLineSegmentsFromHoughTransform(h, ctx, canvasWidth, canvasHeight) {
  var lines = []

  for (var i = 0; i < h.length; i++) {
      var rho = h[i][0]
      var theta = h[i][1]

      var a = Math.cos(theta)
      var b = Math.sin(theta)

      var x0 = a * rho
      var y0 = b * rho

      var pt1 = {}
      pt1.x = Math.round(x0 + 1000 * (-b))
      pt1.y = Math.round(y0 + 1000 * (a))
      var pt2 = {}
      pt2.x = Math.round(x0 - 1000 * (-b))
      pt2.y = Math.round(y0 - 1000 * (a))

      var slope = (pt2.y - pt1.y)/(pt2.x - pt1.x)
      var intercept = pt2.y - slope * pt2.x

      //line
      var line = {}
      line.start = pt1
      line.end = pt2
      line.slope = slope
      line.intercept = intercept
      
      lines.push(line)
  }

  return lines
}

function lineToLineAngleInDegrees(x1, y1, x2, y2, x3, y3, x4, y4) {
  var dx1  = x2 - x1
  var dy1  = y2 - y1
  var dx2  = x4 - x3
  var dy2  = y4 - y3

  var angleInRadians = 
      Math.atan2(dx1 * dy2 - dx2 * dy1, dx1 * dx2 + dy1 * dy2)

  return angleInRadians * 180/Math.PI
}

// line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two line segments
// Return FALSE if the lines don't intersect
function doLinesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  // Check if none of the lines are of length 0
  if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
      return false
  }

  let denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))

  // Lines are parallel
  if (denominator === 0) {
      return false
  }

  let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
  let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

  // is the intersection along the segments
  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
      return false
  }

  // Return a object with the x and y coordinates of the intersection
  let x = x1 + ua * (x2 - x1)
  let y = y1 + ua * (y2 - y1)

  return { x, y }
}

function doPointsOverlap(x1, y1, x2, y2, epsilon = 50) {
  return (
      Math.abs(x1 - x2) <= epsilon &&
      Math.abs(y1 - y2) <= epsilon
  )
}

// Adapted from https://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
function isPointInPolygon(point, polygon) {
  let isPointInPolygon = false

  for (let i = 0, j = polygon.length - 1;
      i < polygon.length; 
      j = i++
  ) {
      if ((polygon[i].y >= point.y) !== (polygon[j].y >= point.y) &&
          point.x <= (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x
      ) {
          isPointInPolygon = !isPointInPolygon
      }
  }

  return isPointInPolygon
}

function isPolygonContained(containingPolygon, containedPolygon) {
  for (let i = 0; i < containedPolygon.length; i++) {
      if (!isPointInPolygon(
          containedPolygon[i], 
          containingPolygon)
      ) {
          return false
      }
  }

  return true
}

function computePolygonSignedArea(polygonSilhouette) {
  var area = 0

  for (let i = 0, j = 0; 
      i < polygonSilhouette.length; 
      i++, j = (i + 1) % polygonSilhouette.length)
  {
      area += polygonSilhouette[i].x * polygonSilhouette[j].y
      area -= polygonSilhouette[j].x * polygonSilhouette[i].y
  }

  return area / 2
}

function findRectangles(lines, canvasWidth, canvasHeight, ctx, epsilon = 10, rectanglePercentualMinArea = 25) {
  function isOrthogonal(v1, v2, v3, epsilon = 5000) {
      return Math.abs((v2.x - v1.x) * (v2.x - v3.x) + (v2.y - v1.y) * (v2.y - v3.y)) <= epsilon
  }

  function isRectangle(vertices) {
      if (vertices.length !== 4)
          return false

      return (
          isOrthogonal(vertices[0], vertices[1], vertices[2]) && 
          isOrthogonal(vertices[1], vertices[2], vertices[3]) && 
          isOrthogonal(vertices[2], vertices[3], vertices[0])
      )
  }

  // Adapted from https://gist.github.com/axelpale/3118596
  function getRectanglesFromVertices(set, n = 4) {
      var i, j, combs, head, tailcombs;
      
      if (n > set.length || n <= 0)
          return []
      
      if (n === set.length)
          return [set]
      
      if (n === 1) {
          combs = []

          for (i = 0; i < set.length; i++)
              combs.push([set[i]])

          return combs
      }

      combs = []

      for (i = 0; i < set.length - n + 1; i++) {
          head = set.slice(i, i + 1)
          tailcombs = getRectanglesFromVertices(set.slice(i + 1), n - 1)

          for (j = 0; j < tailcombs.length; j++)
              combs.push(
                  head.concat(
                      tailcombs[j]
                  )
              )
      }

      return combs
  }
  
  let totalArea = canvasWidth * canvasHeight
  let rectangleMinArea = totalArea * (rectanglePercentualMinArea / 100)

  let intersections = []

  for (var i = 0; i < lines.length; i++) {
      for (var j = 0; j < lines.length; j++) {
          if (j === i)
              continue

          var intersectionPoint = 
              doLinesIntersect(
                  lines[i].start.x, lines[i].start.y,
                  lines[i].end.x, lines[i].end.y,
                  lines[j].start.x, lines[j].start.y,
                  lines[j].end.x, lines[j].end.y)

          if (intersectionPoint) {
              var angle = 
                  lineToLineAngleInDegrees(
                      lines[i].start.x, lines[i].start.y,
                      lines[i].end.x, lines[i].end.y,
                      lines[j].start.x, lines[j].start.y,
                      lines[j].end.x, lines[j].end.y)

              if (Math.abs(90 - angle) < epsilon) {
                  let overlap = false
                  for (var k = 0; k < intersections.length; k++) {
                      overlap = 
                          doPointsOverlap(
                              intersectionPoint.x, 
                              intersectionPoint.y, 
                              intersections[k].x,
                              intersections[k].y
                          )

                      if (overlap) 
                          break
                  }

                  if (!overlap)
                      intersections.push(
                          intersectionPoint
                      )
              }
          }
      }
  }

  drawVertexes(
      intersections,
      ctx
  )

  return getRectanglesFromVertices(intersections, 4)
      .reduce((rectangles, c) => {
          const center = {
              x: c.reduce((acc, p) => acc += p.x, 0) / 4,
              y: c.reduce((acc, p) => acc += p.y, 0) / 4
          }

          let old = c.sort((a, b) => 
              Math.atan2(a.x - center.x, a.y - center.y) 
              - Math.atan2(b.x - center.x, b.y - center.y)
          )

          if (!isRectangle(c))
              return rectangles
          
          if (Math.abs(computePolygonSignedArea(c)) < rectangleMinArea)
              return rectangles

          for (let i = 0; i < rectangles.length; i++) {
              if (isPolygonContained(rectangles[i], c))
                  return rectangles

              if (isPolygonContained(c, rectangles[i]))
                  rectangles.splice(i, 1)
          }

          rectangles.push(c)

          return rectangles
      }, [])
}