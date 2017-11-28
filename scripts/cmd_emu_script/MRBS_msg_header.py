from struct import *

class MRBSMessageHeader:
    'Header of a command/message in MRBS'
    # The packet format is:
    # +--+--+--+--+----------+----------+-----------+--------------+-----------------------
    # | version   | dst mac  | Hub CMD  | length    |  Agent UUIDn | byte data = length
    # | (4 bytes) | (1 byte) | (1 byte) | (2 byte)  |  (8 byte)    |
    # +--+--+--+--+----------+--------- +-----------+--------------+-----------------------
    AGENT_UUID_SIZE = 8
    HEADER_SIZE = 16

    HUB_CMD_FORWARD = 0
    HUB_CMD_GET_AGENT_LIST = 1 # Request list of agent
    HUB_CMD_SET_AGENT_LIST = 2

    def __init__(self, ver, destMAC, hubCMD, agentUUID, length):
        self.ver = int(ver, 16)
        self.dstMAC = int(destMAC, 10)
        self.hubCMD = int(hubCMD, 10)
        self.agentUUID = agentUUID
        self.length = length
        self.data = ""

    def __init__(self):
        self.ver = int("0xCAFECAFE", 16)
        self.dstMAC = 255
        self.hubCMD = 0
        self.agentUUID = [0] * MRBSMessageHeader.AGENT_UUID_SIZE
        self.length = 16
        self.data = ""

    def __del__(self):
        class_name = self.__class__.__name__
        # print class_name + " destroyed"

    def packData(self, length=0):
        if length:
            self.length = length
        else:
            self.length = len(self.data)
        
        uuid = self.agentUUID
        msg_hdr = pack('IBBHBBBBBBBB', self.ver, self.dstMAC, self.hubCMD, self.length, uuid[0], uuid[1], uuid[2], uuid[3], uuid[4], uuid[5], uuid[6], uuid[7])
        msg_data = msg_hdr + self.data
        return msg_data
