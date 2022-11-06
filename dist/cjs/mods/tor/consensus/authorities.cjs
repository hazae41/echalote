'use strict';

/**
 * Tor: src/app/config/auth_dirs.inc
 */
const auth_dirs = `
"moria1 orport=9101 "
  "v3ident=D586D18309DED4CD6D57C18FDB97EFA96D330566 "
  "128.31.0.39:9131 9695 DFC3 5FFE B861 329B 9F1A B04C 4639 7020 CE31",
"tor26 orport=443 "
  "v3ident=14C131DFC5C6F93646BE72FA1401C02A8DF2E8B4 "
  "ipv6=[2001:858:2:2:aabb:0:563b:1526]:443 "
  "86.59.21.38:80 847B 1F85 0344 D787 6491 A548 92F9 0493 4E4E B85D",
"dizum orport=443 "
  "v3ident=E8A9C45EDE6D711294FADF8E7951F4DE6CA56B58 "
  "45.66.33.45:80 7EA6 EAD6 FD83 083C 538F 4403 8BBF A077 587D D755",
"Serge orport=9001 bridge "
  "66.111.2.131:9030 BA44 A889 E64B 93FA A2B1 14E0 2C2A 279A 8555 C533",
"gabelmoo orport=443 "
  "v3ident=ED03BB616EB2F60BEC80151114BB25CEF515B226 "
  "ipv6=[2001:638:a000:4140::ffff:189]:443 "
  "131.188.40.189:80 F204 4413 DAC2 E02E 3D6B CF47 35A1 9BCA 1DE9 7281",
"dannenberg orport=443 "
  "v3ident=0232AF901C31A04EE9848595AF9BB7620D4C5B2E "
  "ipv6=[2001:678:558:1000::244]:443 "
  "193.23.244.244:80 7BE6 83E6 5D48 1413 21C5 ED92 F075 C553 64AC 7123",
"maatuska orport=80 "
  "v3ident=49015F787433103580E3B66A1707A00E60F2D15B "
  "ipv6=[2001:67c:289c::9]:80 "
  "171.25.193.9:443 BD6A 8292 55CB 08E6 6FBE 7D37 4836 3586 E46B 3810",
"Faravahar orport=443 "
  "v3ident=EFCBE720AB3A82B99F9E953CD5BF50F7EEFC7B97 "
  "154.35.175.225:80 CF6D 0AAF B385 BE71 B8E1 11FC 5CFF 4B47 9237 33BC",
"longclaw orport=443 "
  "v3ident=23D15D965BC35114467363C165C4F724B64B4F66 "
  "199.58.81.140:80 74A9 1064 6BCE EFBC D2E8 74FC 1DC9 9743 0F96 8145",
"bastet orport=443 "
  "v3ident=27102BC123E7AF1D4741AE047E160C91ADC76B21 "
  "ipv6=[2620:13:4000:6000::1000:118]:443 "
  "204.13.164.118:80 24E2 F139 121D 4394 C54B 5BCC 368B 3B41 1857 C413",
`;
function parseAuthorities() {
    const lines = auth_dirs
        .replaceAll('\n', '')
        .replaceAll('\"  \"', '')
        .slice(0, -1)
        .split(",");
    const authorities = new Array(lines.length);
    for (let i = 0; i < lines.length; i++) {
        const sline = lines[i].slice(1, -1);
        const authority = parseAuthority(sline);
        authorities[i] = authority;
    }
    return authorities;
}
function parseAuthority(line) {
    const [name, ...words] = line.split(" ");
    const authority = { name };
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (word === "bridge")
            authority.bridge = true;
        else if (word.startsWith("orport="))
            authority.orport = Number(word.slice("orport=".length));
        else if (word.startsWith("v3ident="))
            authority.v3ident = word.slice("v3ident=".length);
        else if (word.startsWith("ipv6="))
            authority.ipv6 = word.slice("ipv6=".length);
        else if (i === words.length - 11)
            authority.ipv4 = word;
    }
    authority.fingerprint = words.slice(-10).map(it => parseInt(it, 16));
    if (!authority.name)
        throw new Error(`Undefined authority name`);
    if (!authority.orport)
        throw new Error(`Undefined authority orport`);
    if (!authority.ipv4)
        throw new Error(`Undefined authority name`);
    if (!authority.fingerprint)
        throw new Error(`Undefined authority fingerprint`);
    return authority;
}

exports.auth_dirs = auth_dirs;
exports.parseAuthorities = parseAuthorities;
exports.parseAuthority = parseAuthority;
//# sourceMappingURL=authorities.cjs.map
