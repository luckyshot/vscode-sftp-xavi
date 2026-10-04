// Modern extension hosts removed util.isDate. Exercise the real SFTP packet
// serializer without a socket so downloads, diffs and timestamps cannot regress.
jest.mock('util', () => ({ ...jest.requireActual('util'), isDate: undefined }));

const { SFTP } = require('ssh2/lib/protocol/SFTP');

function openPacket(attrs) {
  const packets = [];
  const sftp = {
    _writeReqid: -1,
    _requests: {},
    outgoing: { state: 'open', window: 65536, packetSize: 32768, id: 0 },
    _protocol: { channelData: (_id, packet) => packets.push(packet) },
  };
  SFTP.prototype.open.call(sftp, '/test.txt', 'r', attrs, () => {});
  return packets[0];
}

describe('SFTP on modern Node runtimes', () => {
  test.each([{}, 0o666])('opens files with attributes %p without util.isDate', attrs => {
    expect(openPacket(attrs)[4]).toBe(3); // SSH_FXP_OPEN
  });

  test.each([
    [new Date(1700000000000), new Date(1700000001000)],
    [1700000000, 1700000001],
  ])('serializes date and numeric timestamps', (atime, mtime) => {
    const packet = openPacket({ atime, mtime });
    const flagsOffset = 9 + 4 + Buffer.byteLength('/test.txt') + 4;
    expect(packet.readUInt32BE(flagsOffset)).toBe(8); // SSH_FILEXFER_ATTR_ACMODTIME
    expect(packet.readUInt32BE(flagsOffset + 4)).toBe(1700000000);
    expect(packet.readUInt32BE(flagsOffset + 8)).toBe(1700000001);
  });
});
