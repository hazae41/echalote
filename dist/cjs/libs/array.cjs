'use strict';

function lastOf(array) {
    return array[array.length - 1];
}
function randomOf(array) {
    return array[Math.floor(Math.random() * array.length)];
}

exports.lastOf = lastOf;
exports.randomOf = randomOf;
//# sourceMappingURL=array.cjs.map
