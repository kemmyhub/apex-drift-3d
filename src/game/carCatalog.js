const CAR_MODELS = [
        {
            id: 'viper',
            name: 'VORTEX GT',
            tag: 'BALANCED',
            stats: { speed: 88, accel: 86, handling: 85 },
            maxSpeed: 86,
            accelForce: 54,
            turnRate: 2.35,
            grip: 0.92,
            bodyStyle: 'coupe'
        },
        {
            id: 'apex',
            name: 'HYPERION RS',
            tag: 'TOP SPEED',
            stats: { speed: 98, accel: 76, handling: 78 },
            maxSpeed: 96,
            accelForce: 46,
            turnRate: 2.1,
            grip: 0.89,
            bodyStyle: 'prototype'
        },
        {
            id: 'drift',
            name: 'KITSUNE Z',
            tag: 'DRIFT KING',
            stats: { speed: 82, accel: 94, handling: 96 },
            maxSpeed: 82,
            accelForce: 62,
            turnRate: 2.65,
            grip: 0.95,
            bodyStyle: 'tuner'
        }
    ];

    const PAINT_COLORS = [
        { name: 'Electric Cyan', hex: '#0ea5e9' },
        { name: 'Crimson Blaze', hex: '#ef4444' },
        { name: 'Solar Gold', hex: '#f59e0b' },
        { name: 'Emerald Viper', hex: '#10b981' },
        { name: 'Ultraviolet', hex: '#8b5cf6' },
        { name: 'Pearl White', hex: '#f8fafc' }
    ];

    // -------------------------------------------------------------------------
    // 3. 3D RACE CIRCUIT & ENVIRONMENT BUILDER
    // -------------------------------------------------------------------------

export { CAR_MODELS, PAINT_COLORS };
