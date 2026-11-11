export function cruiseStep(speed,throttle,base,dt){const target=base*(throttle?4.5:1),ease=1-Math.exp(-(throttle?5:3)*Math.max(0,Math.min(.05,dt)));return Math.max(base,speed+(target-speed)*ease);}
