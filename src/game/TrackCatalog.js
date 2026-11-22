const TRACK_CATALOG = [
    {
        id: "neon-coast",
        name: "NEON COAST",
        location: "Grand Prix Circuit",
        description: "Fast straights, sweeping corners and a flowing coastal layout.",
        roadWidth: 24,
        groundColor: 0x153624,
        skyColor: 0x0c192c,
        fogColor: 0x0c192c,
        fogDensity: 0.0022,
        treeColor: 0x166534,
        points: [[0,0,0],[0,0,-140],[45,0,-240],[165,0,-260],[250,0,-190],[230,0,-85],[145,0,-45],[155,0,55],[255,0,115],[235,0,225],[115,0,255],[25,0,195],[-15,0,110]]
    },
    {
        id: "alpine-pass",
        name: "ALPINE PASS",
        location: "Alpine Loop Circuit",
        description: "A technical mountain loop with tight switchbacks and quick direction changes.",
        roadWidth: 22,
        groundColor: 0x34433d,
        skyColor: 0x172b3c,
        fogColor: 0x9ab4c2,
        fogDensity: 0.0018,
        treeColor: 0x315b48,
        points: [[0,0,0],[55,0,-95],[155,0,-155],[245,0,-115],[265,0,-15],[205,0,65],[95,0,75],[40,0,145],[-55,0,220],[-175,0,205],[-245,0,120],[-185,0,20],[-85,0,-35]]
    },
    {
        id: "desert-run",
        name: "DESERT RUN",
        location: "Redline Desert Circuit",
        description: "A wide, high-speed desert route with long arcs and heavy braking zones.",
        roadWidth: 26,
        groundColor: 0x80603a,
        skyColor: 0x49301f,
        fogColor: 0xc18a54,
        fogDensity: 0.00125,
        treeColor: 0x6e6a38,
        points: [[0,0,0],[-80,0,-125],[-195,0,-175],[-285,0,-95],[-260,0,35],[-155,0,110],[-35,0,95],[95,0,155],[225,0,205],[295,0,115],[245,0,-20],[155,0,-95],[75,0,-45]]
    }
];

function getTrackConfig(trackId) {
    return TRACK_CATALOG.find(track => track.id === trackId) || TRACK_CATALOG[0];
}

export { TRACK_CATALOG, getTrackConfig };
