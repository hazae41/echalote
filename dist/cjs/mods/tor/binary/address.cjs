'use strict';

class TypedAddress {
    constructor(type, value) {
        this.type = type;
        this.value = value;
        this.class = TypedAddress;
    }
    write(binary) {
        binary.writeUint8(this.type);
        binary.writeUint8(this.value.length);
        binary.write(this.value);
    }
    static read(binary) {
        const type = binary.readUint8();
        const length = binary.readUint8();
        const value = binary.read(length);
        return new this(type, value);
    }
}
TypedAddress.IPv4 = 4;
TypedAddress.IPv6 = 6;
class Address4 {
    /**
     * IPv4 address
     * @param address xxx.xxx.xxx.xxx
     */
    constructor(address) {
        this.address = address;
        this.class = Address4;
    }
    write(binary) {
        const parts = this.address.split(".");
        for (let i = 0; i < 4; i++)
            binary.writeUint8(Number(parts[i]));
    }
    static read(binary) {
        const parts = new Array(4);
        for (let i = 0; i < 4; i++)
            parts[i] = String(binary.readUint8());
        return new this(parts.join("."));
    }
}
class Address6 {
    /**
     * IPv6 address
     * @param address [xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx]
     */
    constructor(address) {
        this.address = address;
        this.class = Address6;
    }
    write(binary) {
        const parts = this.address.slice(1, -1).split(":");
        for (let i = 0; i < 8; i++)
            binary.writeUint16(Number(parts[i]));
    }
    static read(binary) {
        const parts = new Array(8);
        for (let i = 0; i < 8; i++)
            parts[i] = String(binary.readUint16());
        return new this(`[${parts.join(":")}]`);
    }
}

exports.Address4 = Address4;
exports.Address6 = Address6;
exports.TypedAddress = TypedAddress;
//# sourceMappingURL=address.cjs.map
