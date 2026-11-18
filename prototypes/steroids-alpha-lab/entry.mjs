// Candidate combat is an independent page lifetime. It cannot replace live settings or join a room.
if (new URLSearchParams(location.search).has('evolution')) void import('./evolution');
else if (new URLSearchParams(location.search).has('duel')) void import('./duel');
else void import('./lab.mjs');
