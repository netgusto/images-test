const rp = require("request-promise-native");
const baseURL = "https://imagedelivery.net/Vi7wi5KSItxGFsWRG2Us6Q";
const variants = ["w200", "w1000", "w2000", "w3000", "w4000", "zmax", "width=30,height=30"];

function buildURLs(freqName) {
    return variants.map(v => `${baseURL}/testimg-${freqName}.jpg/${v}`);
}

function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}

async function loopFreq(freqInSeconds, freqName) {
    while (true) {
        const roundStart = new Date();
        console.error(`${roundStart.toISOString()}: another round ${freqName}`);
        const urls = buildURLs(freqName);
        const promises = urls.flatMap(url => {
            return [
                fetchAndMeasure(url, freqName, "image/jpg"),
                fetchAndMeasure(url, freqName, "image/png"),
                fetchAndMeasure(url, freqName, "image/webp"),
                fetchAndMeasure(url, freqName, "image/avif")
            ];
        });
        const results = await Promise.all(promises);
        const lines = results.map(JSON.stringify);
        lines.map(line => console.log(line));

        const remaining = Math.min(freqInSeconds - (((new Date()).getTime() - roundStart.getTime()) / 1000), freqInSeconds);
        if(remaining > 0) {
            console.error(`Freq ${freqName}, wait ${remaining}`);
            await sleep(remaining);
        }
    }
}

async function fetchAndMeasure(url, freqName, accept) {
    let measure = {
        date: (new Date()).toISOString(),
        freq: freqName,
        accept,
        url,
    };

    try {
        const res = await rp({
            uri: url,
            method: 'GET',
            time: true,
            resolveWithFullResponse: true,
            headers: { 'Accept': accept }
        });

        const cfImagesMetrics = parseCfImagesHeader(res.headers['cf-images']);
        return {
            ...measure,
            success: true,
            cacheStatus: res.headers['cf-cache-status'],
            cfImages: res.headers['cf-images'],
            cfImagesN: cfImagesMetrics.n,
            cfImagesC: cfImagesMetrics.c,
            ttfb: parseInt(res.timings.response - res.timings.connect),
            contentType: res.headers['content-type'],
            warning: res.headers['warning'],
            ray: res.headers['cf-ray'],
            colo: getColo(res.headers['cf-ray']),
        };
    } catch (e) {
        return {
            ...measure,
            success: false,
            error: e,
        };
    }
}

function getColo(ray) {
    const matches = /-(?<colo>.+)$/.exec(ray);
    if (!matches || !matches.groups) {
      return "?";
    }

    return matches.groups["colo"];
}

function parseCfImagesHeader(headerValue) {
    const response = { n: undefined, c: undefined };
    if(!headerValue) return response;

    const matches = /\sn=(?<n>[0-9]+)\sc=(?<c>[0-9]+)\s/.exec(headerValue);
    if (!matches || !matches.groups) {
      return response;
    }

    response.n = parseInt(matches.groups["n"]);
    response.c = parseInt(matches.groups["c"]);

    return response;
}

loopFreq(10, "10s");
loopFreq(60, "1m");
loopFreq(60*10, "10m");
loopFreq(60*30, "30m");
loopFreq(60*60, "1h");
loopFreq(60*60*5, "5h");
