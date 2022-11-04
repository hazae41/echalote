'use strict';

exports.Events = void 0;
(function (Events) {
    function clone(event) {
        if (event instanceof MessageEvent) {
            const { data, cancelable } = event;
            return new MessageEvent(event.type, { data, cancelable });
        }
        if (event instanceof CloseEvent) {
            const { code, reason, wasClean, cancelable } = event;
            return new CloseEvent(event.type, { code, reason, wasClean, cancelable });
        }
        if (event instanceof ErrorEvent) {
            const { error, message, cancelable } = event;
            return new ErrorEvent(event.type, { error, message, cancelable });
        }
        const { cancelable } = event;
        return new Event(event.type, { cancelable });
    }
    Events.clone = clone;
    function error(error, message) {
        if (error instanceof Error)
            return error;
        if (error instanceof ErrorEvent)
            return Events.error(error.error, error.message);
        if (error instanceof MessageEvent)
            return new Error(message !== null && message !== void 0 ? message : error.type, { cause: error.data });
        if (error instanceof Event)
            return new Error(message !== null && message !== void 0 ? message : error.type, { cause: error });
        return new Error(message !== null && message !== void 0 ? message : typeof error, { cause: error });
    }
    Events.error = error;
})(exports.Events = exports.Events || (exports.Events = {}));
//# sourceMappingURL=events.cjs.map
