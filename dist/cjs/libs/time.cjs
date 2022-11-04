'use strict';

function ttlToDate(ttl) {
    return new Date(Date.now() + (ttl * 1000));
}
function dateToTtl(date) {
    return ~~((date.getTime() - Date.now()) / 1000);
}

exports.dateToTtl = dateToTtl;
exports.ttlToDate = ttlToDate;
//# sourceMappingURL=time.cjs.map
