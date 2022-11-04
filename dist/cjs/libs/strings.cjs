'use strict';

exports.Strings = void 0;
(function (Strings) {
    function splitOnce(text, splitter) {
        const index = text.indexOf(splitter);
        const first = text.slice(0, index);
        const last = text.slice(index + splitter.length);
        return [first, last];
    }
    Strings.splitOnce = splitOnce;
})(exports.Strings = exports.Strings || (exports.Strings = {}));
//# sourceMappingURL=strings.cjs.map
