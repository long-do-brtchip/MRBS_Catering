import os
import json
import argparse
from socket import *
from struct import *

# RFID Command Code
AGENT_RFID_CMD = 221

# Variable used to connect to Agent
agent_socket = socket(AF_INET, SOCK_DGRAM, 0)
agent_host = "127.0.0.1"
agent_port = 9999
agent_mac  = 16

# Variable represented for PanL70 device
panl70_mac = 16

# Variable represented for RFID ID Card
rfid_card_id = "0123456789"

parser = argparse.ArgumentParser(description='RFID')
parser.add_argument('-p', help = 'MRBS Agent Port address\n\rExample:\t-p 9999', action='store', nargs='+')
parser.add_argument('-i', help = 'MRBS Agent IP address\n\rExample:\t-i 192.168.1.1', action='store', nargs='+')
parser.add_argument('-m', help = 'MRBS Agent MAC address\n\rExample:\t-m 255', action='store', nargs='+')
parser.add_argument('-d', help = 'PanL70 MAC\n\rExample:\t-d 16', action='store', nargs='+')
parser.add_argument('-c', help = 'RFID ID data\n\rExample:\t-c 1234567890a', action='store', nargs='+')
parser.add_argument('-n', help = 'Run with default configration', action='store_true')

arg = 0
try:
    arg = parser.parse_args()
except:
    print 'Incorrect argument'
    exit(-1)

if arg.p:
    agent_port = int(arg.p[0])

if arg.i:
    agent_host = arg.i[0]

if arg.m:
    agent_mac = int(arg.m[0])

if arg.d:
    panl70_mac = int(arg.d[0])

if arg.c:
    rfid_card_id = arg.c[0]

print "MRBS Agent port address: " + str(agent_port)
print "MRBS Agent IP address  : " + agent_host
print "MRBS Agent MAC address : " + str(agent_mac)
print "PanL70 MAC address     : " + str(panl70_mac)
print "RFID Card ID           : " + rfid_card_id

# The packet format is:
# +--+--+--+--+----------+----------+-----------+-----------------------
# | version   | dst mac  | src mac  | length    |  n byte data = length
# | (4 bytes) | (1 byte) | (1 byte) | (2 byte)  |
# +--+--+--+--+----------+--------- +-----------+-----------------------
#
HEADER_SIZE = 8
packet_ver    = int("0xCAFECAFE", 16)
packet_dstmac = int(agent_mac)
packet_srcmac = panl70_mac

agent_cmd = pack('B', AGENT_RFID_CMD)
packet_length = len(rfid_card_id) + len(agent_cmd)

msg_hdr = pack('IBBH', packet_ver, packet_dstmac, packet_srcmac, packet_length)
msg_data = msg_hdr + agent_cmd + rfid_card_id

try:
     #Set a timeout value of 1 second
    agent_socket.settimeout(1)
    agent_address = (agent_host, int(agent_port))
    agent_socket.sendto(msg_data, agent_address)
except:
    print 'Cannot Send data to MRBS agent'
    exit(-1)
