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
  
  const r = 2
  const kernel_size = (r + 1) << 1
  const sigma = 4
  jsfeat.imgproc.gaussian_blur(
    image, 
    img_u8, 
    kernel_size, 
    sigma
  )

  const low_threshold = 1
  const high_threshold = 127
  jsfeat.imgproc.canny(
    img_u8,
    img_u8, 
    low_threshold, 
    high_threshold
  )

  const rho_res = 1
  const theta_res = (Math.PI / 540)
  const threshold = (height < width ? height : width) * .18
  const houghTransform = 
    jsfeat.imgproc.hough_transform(
      img_u8, 
      rho_res, 
      theta_res, 
      threshold
    )

  var lines = 
    getLineSegmentsFromHoughTransform(
      houghTransform, 
      width, 
      height
    )

  var dedupedLines =
    removeDuplicates(
      lines  
    )

  const rectangles = 
    findRectangles(
      dedupedLines, 
      width, 
      height
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

function pointToPointDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x1 - x2) + Math.pow(y1 - y2))
}

function lineToLineDistance(x1, y1, x2, y2, x3, y3, x4, y4) {
  return [
      pointToPointDistance(x1, y1, x3, y3),
      pointToPointDistance(x1, y1, x4, y4),
      pointToPointDistance(x2, y2, x3, y3),
      pointToPointDistance(x2, y2, x4, y4)
  ].sort((a, b) => a - b)[0]
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

function doLinesOverlap(x1, y1, x2, y2, x3, y3, x4, y4, epsilon = 12.5) {
  var intersection = doLinesIntersect(x1, y1, x2, y2, x3, y3, x4, y4)
  var distance = lineToLineDistance(x1, y1, x2, y2, x3, y3, x4, y4)
  var line1Slope = (y1 - y2) / (x1 - x2)
  var line2Slope = (y3 - y4) / (x3 - x4)

  return (Math.abs(line1Slope - line2Slope) < epsilon && intersection)
      || (
        Math.abs(line1Slope - line2Slope) < epsilon && !intersection 
        && distance < epsilon
      )
}

function removeDuplicates(lines) {
  return lines.reduce(
      (acc, curr) => {
          for (var i = 0; i < acc.length; i++) {
              var overlap = 
                  doLinesOverlap(
                      curr.start.x, curr.start.y, 
                      curr.end.x, curr.end.y,
                      acc[i].start.x, acc[i].start.y,
                      acc[i].end.x, acc[i].end.y)

              if (overlap)
                  return acc
          }

          return acc.concat(curr)
      }, [])
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

function findRectangles(lines, canvasWidth, canvasHeight, epsilon = 10, rectanglePercentualMinArea = 25) {
  function createNDimensionalArray(length) {
      var arr = new Array(length || 0),
          i = length;

      if (arguments.length > 1) {
          var args = Array.prototype.slice.call(arguments, 1);
          while (i--) arr[length-1 - i] = createNDimensionalArray.apply(this, args);
      }

      return arr;
  }

  let totalArea = canvasWidth * canvasHeight
  let rectangleMinArea = totalArea * (rectanglePercentualMinArea / 100)

  let intersections = 
      createNDimensionalArray(
          lines.length, 
          lines.length
      )

  for (var i = 0; i < lines.length; i++) {
      for (var j = 0; j < lines.length; j++) {
          if (j === i)
              continue

          if (intersections[j][i] || intersections[i][j])
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

              if (Math.abs(90 - angle) < epsilon) 
                  intersections[i][j] = intersectionPoint

              continue
          }
      }
  }   

  let rectangles = []

  for (var i = 0; i < lines.length; i++) {
      let rectangleCandidate = []

      let line1index = i

      for (var j = 0; j < lines.length; j++) {
          if (!intersections[line1index][j] && !intersections[j][line1index])
              continue

          if (rectangleCandidate.length < 2) {
              rectangleCandidate.push(
                  !intersections[j][line1index] ? 
                      intersections[line1index][j] : 
                      intersections[j][line1index]
              )

              intersections[j][line1index] = null
              intersections[line1index][j] = null
              
              line1index = j
              j = 0
          } else if (intersections[j][i] || intersections[i][j]) {
              rectangleCandidate.push(
                  !intersections[j][line1index] ? 
                      intersections[line1index][j] :
                      intersections[j][line1index]
              )
          
              intersections[j][line1index] = null
              intersections[line1index][j] = null

              rectangleCandidate.push(
                  !intersections[i][j] ? 
                      intersections[j][i] :
                      intersections[i][j]
              )
          
              intersections[i][j] = null
              intersections[j][i] = null

              const center = {
                  x: rectangleCandidate.reduce((acc, p) => acc += p.x, 0) / 4,
                  y: rectangleCandidate.reduce((acc, p) => acc += p.y, 0) / 4
              }

              rectangleCandidate.sort((a, b) => {
                  const atana = Math.atan2(a.x - center.x, a.y - center.y)
                  const atanb = Math.atan2(b.x - center.x, b.y - center.y)
                  return atana - atanb
              })
          
              if (Math.abs(computePolygonSignedArea(rectangleCandidate)) > rectangleMinArea) {
                  rectangles.push(rectangleCandidate)
                  break
              }
          }
      }
  }

  return rectangles
}
