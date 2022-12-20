// minimum and maximum Latitude and Longitude to focus the map on Finland
let minLatitude = 59.85,
    maxLatitude = 70.09,
    minLongitude = 20.64,
    maxLongitude = 27.87,
// mapping the geo coordinates to the screen
    screenToGeoXRatio,
    screenToGeoYRatio,
// offset of the map so the speed sample is visible
    xOffset = 100,
    yOffset = 0,
    w = 4,
    h = 4,
// placeholders for the retrieved data
    features = [],
    stations = [],
// the target FPS when using requestAnimationFrame
    fpsInterval,
// storing important timestamps
    startTime,
    now,
    then,
    elapsed,
// placeholder for trains and statistics related to them
    trains = [],
    selectedTrain = null,
    dpr = window.devicePixelRatio,
// getting the context of the map and tachograf canvases
    mapCanvasContext = mapCanvas.getContext('2d'),
    tachografCanvasContext = tachografCanvas.getContext('2d')


// initializing the canvas
init();

// re-initialize on resizing
window.addEventListener('resize', init);

// fetch the station names and positions so those could me visualized on the map
fetchStations();

// start the loop
startAnimating(1);

// making sure that the content on the canvas is not blurred
function adjustCanvasdpr(canvas) {
    canvas.setAttribute('height', +getComputedStyle(canvas).getPropertyValue("height").slice(0, -2) * dpr);
    canvas.setAttribute('width', +getComputedStyle(canvas).getPropertyValue("width").slice(0, -2) * dpr);
}

function startAnimating(fps) {
    fpsInterval = 1000 / fps;
    then = Date.now();
    startTime = then;
    loop();
}

function init() {
// set the correct dpr
    adjustCanvasdpr(mapCanvas);
    adjustCanvasdpr(tachografCanvas);
// calculate the correct geo to screen ratio
    screenToGeoYRatio = (mapCanvas.height) / (maxLongitude - minLongitude) * 0.9;
    screenToGeoXRatio = screenToGeoYRatio / dpr / 2;
// clean the map canvas
    mapCanvasContext.fillStyle = 'black';
    mapCanvasContext.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
// draw the stations    
    drawAllStations(stations);
// draw the speed sample to understand the color coding    
    drawSpeedSample();
// refresh the tachograf pane
    refreshTachograf();
};

function loop() {
    window.requestAnimationFrame(loop);
    now = Date.now();
    elapsed = now - then;
    if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);
        mapCanvasContext.globalCompositeOperation = 'source-over';
// fetch the currently running trains
        fetchCurrentlyRunningTrains();
// refresh the tachograf pane        
        refreshTachograf();
    }
}

function fetchCurrentlyRunningTrains() {
    fetch('https://rata.digitraffic.fi/api/v1/train-locations/latest/')
        .then((response) => response.json())
        .then((data) => features = data)
        .then((data) => drawAllTrains(features))
}

function fetchStations() {
    fetch('https://rata.digitraffic.fi/api/v1/metadata/stations')
        .then((response) => response.json())
        .then((data) => stations = data)
        .then((data) => drawAllStations(stations))
}

function drawAllTrains(f) {
    f.forEach((element) => {
// visualize the current location and speed (color coding) of each train        
        drawTrain(element.location.coordinates[0], element.location.coordinates[1], element.speed)
    })
    mapCanvasContext.globalCompositeOperation = 'source-over';
    upsertAllTrains(f);
}

function drawTrain(longitude, latitude, speed) {
    let x = Math.floor(xOffset + (longitude - minLongitude) * screenToGeoXRatio);
    let y = Math.floor(yOffset + mapCanvas.height - (latitude - minLatitude) * screenToGeoYRatio - 50);
    mapCanvasContext.fillStyle = getColorBasedOnSpeed(speed);
    mapCanvasContext.fillRect(x, y, w, h);
}

function drawAllStations(s) {
    s.forEach((element) => {
        if (element.passengerTraffic === true && element.type === `STATION`) drawStation(element.longitude, element.latitude, element.stationName);
    });
}

function drawStation(longitude, latitude, name) {
    let x = Math.floor(xOffset + (longitude - minLongitude) * screenToGeoXRatio);
    let y = Math.floor(yOffset + mapCanvas.height - (latitude - minLatitude) * screenToGeoYRatio - 50);
    mapCanvasContext.font = '1em sans-serif';
    mapCanvasContext.fillStyle = '#555555';
    mapCanvasContext.fillText(name, x + 5, y + 5);
    mapCanvasContext.fillStyle = '#ffffff';
    mapCanvasContext.fillRect(x-1, y-1, 2, 2);
}

function getColorBasedOnSpeed(speed) {
// speed based color coding
    return `rgb(${Math.floor(255 - speed)}, ${Math.floor(speed * 1.2)}, ${Math.floor( speed * 0.6)})`;
}

function drawSpeedSample() {
// draw a sample to understand the speed color coding
    mapCanvasContext.font = '1.2em sans-serif';
    for (i = 0; i <= 220; i = i + 10) {
        mapCanvasContext.fillStyle = getColorBasedOnSpeed(i);
        mapCanvasContext.fillRect(20, 20 + i * 2, 20, h);
        mapCanvasContext.fillText(`${i} km/h`, 50, 25 + i * 2);
    }
}

function upsertAllTrains(f) {
    let y = 25;
    f.forEach((element) => {
        upsertTrain(element);
        y = y + 15;
    })
}

function upsertTrain(element) {
// update an existing train metadata or insert a new one
    let numberOfTrains = trains.length;
    let index = 0;
    let done = false;
    let newTrain = {no: element.trainNumber, stats: []};
    const trainDiv = document.createElement('div');
    trainDiv.className = 'train';
    trainDiv.addEventListener('click', function () {
        if (selectedTrain != null) {
            document.getElementById(selectedTrain).classList.remove('selected');
        }
        selectedTrain = trainDiv.id;
        trainDiv.classList.add('selected');
        refreshTachograf();
    });

    while (index <= numberOfTrains && !done) {
        if (!done && index == numberOfTrains) {
            trains.push(newTrain);
            trainDiv.id = index;
            trainDiv.innerHTML = formatTrainName(trains[index]);
            if (numberOfTrains > 0) {
                if (document.getElementById(index - 1) != undefined) document.getElementById(index - 1).insertAdjacentElement('afterend', trainDiv);
            } else if (document.getElementById('trainContainer') != undefined) document.getElementById('trainContainer').insertAdjacentElement('afterbegin', trainDiv);
            done = true;
        } else if (trains[index].no === element.trainNumber) {
            if (document.getElementById(index) != undefined) {
                let targetInnerHtml = formatTrainName(trains[index]);
                if (document.getElementById(index).innerHTML != targetInnerHtml)
                    document.getElementById(index).innerHTML = formatTrainName(trains[index])
            }
            ;
            done = true;
        } else if (trains[index].no > element.trainNumber) {
            trains.splice(index, 0, newTrain);
            trainDiv.innerHTML = formatTrainName(trains[index]);
            trainDiv.id = index;
            if (document.getElementById(index) != undefined) document.getElementById(index).insertAdjacentElement('beforebegin', trainDiv);
            done = true;
        }
        if (done)
            collectTrainStats(element, index);
        index++;
    }
}

function formatTrainName(train) {
// format the train name
    let returnValue = '';
    if (train != undefined && train.no != undefined) {
        returnValue += 'Train #' + train.no;
        if (train.stats != undefined && train.stats.length > 0) {
            returnValue += ' (' + train.stats[train.stats.length - 1].speed + 'km/h) [' + train.stats.length + ']';
        }
    } else
        returnValue = 'error';
    return returnValue;
}

function collectTrainStats(element, index) {
// manage the collected train statistics
    let newTrainStat = {timestamp: element.timestamp, trainLocation: element.location, speed: element.speed};
    if (trains[index].stats.length == 0 || trains[index].stats.slice(-1)[0].timestamp != element.timestamp)
        trains[index].stats.push(newTrainStat);
}

function refreshTachograf() {
// visualize the speed of the selected train over time
    if (selectedTrain == null) return;
    let yAxisTopMargin = 100.5;
    let yAxisBottomMargin = 10.5;
    let yAxisLeftMargin = 80.5;
    let yAxisRightMargin = 50;
    let yAxisMajorIntervalStep = 4;
    let font = '1em sans-serif';
    let titleFont = '1.5em sans-serif';
    let fontHeight = 5;
    let diagrammingPeriodInSeconds = 360;
    let yAxisMinorIntervals = 24;
    let yAxisMinorIntervalSpacingInSeconds = diagrammingPeriodInSeconds / yAxisMinorIntervals;
    let xAxisMaxValue = 220;
    let xAxisScale = (tachografCanvas.width - yAxisLeftMargin - yAxisRightMargin) / xAxisMaxValue;
    let yAxisScale = (tachografCanvas.height - yAxisTopMargin - yAxisBottomMargin) / diagrammingPeriodInSeconds;
    let xAxisMinorIntervals = 11;
    let xAxisMajorIntervalStep = 5;
    let dataPointSize = 8;
    let firstStatIndex = -1;
// draw the main grid
    tachografCanvasContext.fillStyle = '#1a2639';
    tachografCanvasContext.fillRect(0, 0, tachografCanvas.width, tachografCanvas.height);
    tachografCanvasContext.lineWidth = 0.5;
    tachografCanvasContext.strokeStyle = '#333333';
    tachografCanvasContext.beginPath();
    tachografCanvasContext.moveTo(yAxisLeftMargin, yAxisTopMargin);
    tachografCanvasContext.lineTo(yAxisLeftMargin, tachografCanvas.height);
    tachografCanvasContext.stroke();
    let train = trains[selectedTrain];
    tachografCanvasContext.font = titleFont;
    tachografCanvasContext.fillStyle = 'white';
    tachografCanvasContext.fillText('Speed statistics of train #' + train.no, 15, 35);
    tachografCanvasContext.font = font;
    if (train.stats.length == 0) return false;

    let lastTimestamp = new Date(train.stats.slice(-1)[0].timestamp);

    if (train.stats.length == 1)
        firstStatIndex = 0;
    else {
        let statIndex = 0;
        while (firstStatIndex == -1) {
            let timestamp = new Date(train.stats[statIndex].timestamp);
            let timeDifferenceInSeconds = (lastTimestamp.getTime() - timestamp.getTime()) / 1000;
            if (timeDifferenceInSeconds <= diagrammingPeriodInSeconds) {
                firstStatIndex = statIndex;
            } else
                statIndex++;
        }
    }
// draw the horizontal gridlines
    let firstTimestamp = new Date(train.stats[firstStatIndex].timestamp);
    for (let MinorInterval = 0; MinorInterval <= yAxisMinorIntervals; MinorInterval++) {
        firstTimestamp.setSeconds(firstTimestamp.getSeconds() + yAxisMinorIntervalSpacingInSeconds);
        if ((MinorInterval + firstStatIndex) % yAxisMajorIntervalStep == 0) {
            tachografCanvasContext.fillStyle = '#dddddd';
            tachografCanvasContext.strokeStyle = '#777777';
            tachografCanvasContext.setLineDash([]);
        } else {
            tachografCanvasContext.fillStyle = '#888888';
            tachografCanvasContext.strokeStyle = '#333333';
            tachografCanvasContext.setLineDash([5, 3]);
        }
        tachografCanvasContext.fillText(firstTimestamp.toTimeString().split(' ')[0], yAxisLeftMargin - 65, yAxisTopMargin + fontHeight + MinorInterval * yAxisMinorIntervalSpacingInSeconds * yAxisScale);
        tachografCanvasContext.beginPath();
        tachografCanvasContext.moveTo(yAxisLeftMargin - 5, yAxisTopMargin + MinorInterval * yAxisMinorIntervalSpacingInSeconds * yAxisScale);
        tachografCanvasContext.lineTo(tachografCanvas.width - yAxisRightMargin, yAxisTopMargin + MinorInterval * yAxisMinorIntervalSpacingInSeconds * yAxisScale);
        tachografCanvasContext.stroke();
    }
// draw the vertical gridlines
    for (let xAxisMinorInterval = 0; xAxisMinorInterval < xAxisMinorIntervals; xAxisMinorInterval++) {
        if (xAxisMinorInterval % xAxisMajorIntervalStep == 0) {
            tachografCanvasContext.fillStyle = '#dddddd';
            tachografCanvasContext.strokeStyle = '#777777';
            tachografCanvasContext.setLineDash([]);
            tachografCanvasContext.fillText(xAxisMinorInterval * xAxisMaxValue / xAxisMinorIntervals + 'km/h', yAxisLeftMargin + xAxisMinorInterval * xAxisMaxValue / xAxisMinorIntervals * xAxisScale, yAxisTopMargin - fontHeight * 3);
        } else {
            tachografCanvasContext.fillStyle = '#888888';
            tachografCanvasContext.strokeStyle = '#333333';
            tachografCanvasContext.setLineDash([5, 3]);
        }
        tachografCanvasContext.beginPath();
        tachografCanvasContext.moveTo(yAxisLeftMargin + xAxisMinorInterval * xAxisMaxValue / xAxisMinorIntervals * xAxisScale, yAxisTopMargin - fontHeight * 1);
        tachografCanvasContext.lineTo(yAxisLeftMargin + xAxisMinorInterval * xAxisMaxValue / xAxisMinorIntervals * xAxisScale, tachografCanvas.height - yAxisBottomMargin);
        tachografCanvasContext.stroke();
    }
    tachografCanvasContext.restore();

// visualize the data
    tachografCanvasContext.strokeStyle = 'yellow';
    tachografCanvasContext.lineWidth = 2;
    tachografCanvasContext.setLineDash([]);
    tachografCanvasContext.fillStyle = 'white';
    firstTimestamp = new Date(train.stats[firstStatIndex].timestamp);
    if (train.stats.length > 0) {
        tachografCanvasContext.beginPath();
        let currentXCoordinate = yAxisLeftMargin + train.stats[firstStatIndex].speed * xAxisScale;
        let currentYCoordinate = yAxisTopMargin;
        tachografCanvasContext.fillRect(currentXCoordinate - dataPointSize / 2, currentYCoordinate - dataPointSize / 2, dataPointSize, dataPointSize);
        tachografCanvasContext.moveTo(currentXCoordinate, currentYCoordinate);
        for (let trainIndex = firstStatIndex + 1; trainIndex < train.stats.length; trainIndex++) {
            let timestamp = new Date(train.stats[trainIndex].timestamp);
            let timeDifferenceInSeconds = (timestamp.getTime() - firstTimestamp.getTime()) / 1000;
            currentXCoordinate = yAxisLeftMargin + train.stats[trainIndex].speed * xAxisScale;
            currentYCoordinate = yAxisTopMargin + timeDifferenceInSeconds * yAxisScale;
            tachografCanvasContext.lineTo(currentXCoordinate, currentYCoordinate);
            tachografCanvasContext.fillRect(currentXCoordinate - dataPointSize / 2, currentYCoordinate - dataPointSize / 2, dataPointSize, dataPointSize);
        }
        tachografCanvasContext.stroke();
    }
}