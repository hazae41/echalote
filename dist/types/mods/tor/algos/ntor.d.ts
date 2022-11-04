declare function request(publicx: Buffer, idh: Buffer, oid: Buffer): Buffer;
declare function response(data: Buffer): {
    publicy: Buffer;
    auth: Buffer;
};
interface NtorResult {
    auth: Buffer;
    nonce: Buffer;
    forwardDigest: Buffer;
    backwardDigest: Buffer;
    forwardKey: Buffer;
    backwardKey: Buffer;
}
declare function finalize(sharedxy: Buffer, sharedxb: Buffer, publici: Buffer, publicb: Buffer, publicx: Buffer, publicy: Buffer): Promise<NtorResult>;

export { NtorResult, finalize, request, response };
