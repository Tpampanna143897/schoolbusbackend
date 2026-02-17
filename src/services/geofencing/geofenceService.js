const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
};

/**
 * Geofencing Service
 * Handles enter/exit stop detection
 */
const checkStopStatus = async (location, stops, previousState) => {
    const results = {
        arrived: [], // stops newly arrived at
        departed: [], // stops newly departed from
        currentState: { ...previousState }
    };

    for (const stop of stops) {
        const distance = getDistance(location.lat, location.lng, stop.lat, stop.lng);
        const radius = stop.radius || 50; // default 50m
        const stopId = stop._id.toString();

        const wasInside = previousState[stopId] === "INSIDE";
        const isInside = distance <= radius;

        if (isInside && !wasInside) {
            results.arrived.push(stop);
            results.currentState[stopId] = "INSIDE";
        } else if (!isInside && wasInside) {
            results.departed.push(stop);
            results.currentState[stopId] = "OUTSIDE";
        }
    }

    return results;
};

module.exports = { getDistance, checkStopStatus };
