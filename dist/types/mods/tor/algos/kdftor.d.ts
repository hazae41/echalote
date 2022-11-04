interface KDFResult {
    keyHash: Buffer;
    forwardDigest: Buffer;
    backwardDigest: Buffer;
    forwardKey: Buffer;
    backwardKey: Buffer;
}
declare function kdftor(k0: Buffer): Promise<KDFResult>;

export { KDFResult, kdftor };
