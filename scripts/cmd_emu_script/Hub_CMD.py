import os
import json
import argparse
from socket import *
from struct import *
import MRBS_msg_header
import uuid
import serial.tools.list_ports

# Command defaul data
CMD_DEFAULT_DATA_JSON = {}
with open('mrbs_cmd_default_val.json') as json_file:
        CMD_DEFAULT_DATA_JSON = json.load(json_file)

# Device default informations
DEVICE_INFO_DATA_JSON = {}
with open('device_info.json') as json_file:
        DEVICE_INFO_DATA_JSON = json.load(json_file)

# Variable used to connect to HUB
HUB_SOCKET = socket(AF_INET, SOCK_DGRAM, 0)
HUB_HOST = DEVICE_INFO_DATA_JSON['HUB_Info']['host']
HUB_PORT = int(DEVICE_INFO_DATA_JSON['HUB_Info']['port'])

# CMD Message package
AGENT_UUID = DEVICE_INFO_DATA_JSON['Agent_Info']['uuid']
AGENT_UUID = AGENT_UUID.split(":")
AGENT_UUID = map(int, AGENT_UUID)

MRBS_CMD_MSG = MRBS_msg_header.MRBSMessageHeader()
MRBS_CMD_MSG.ver    = int(DEVICE_INFO_DATA_JSON['Agent_Info']['ver'], 16)
MRBS_CMD_MSG.dstMAC = int(DEVICE_INFO_DATA_JSON['PanL70_Info']['mac'])
MRBS_CMD_MSG.hubCMD = MRBS_CMD_MSG.HUB_CMD_FORWARD
MRBS_CMD_MSG.agentUUID = AGENT_UUID
MRBS_CMD_MSG.data = ""

# Paser argument
parser = argparse.ArgumentParser(description='MRBS HUB CMD Emulator - This script will send CMD to Agent')
parser.add_argument('-p', help = 'MRBS HUB Port address,\tExample:\t-p 9999', action='store', nargs='+')
parser.add_argument('-i', help = 'MRBS HUB IP address,\tExample:\t-t 192.168.1.1', action='store', nargs='+')
parser.add_argument('-a', help = 'Select Agent will be sent command, \tExample:\t-a 1', action = 'store', nargs='+')
parser.add_argument('-m', help = 'Select PanL70 MAC will be sent command, \tExample:\t-m 16', action = 'store', nargs='+')

# Command parameters
parser.add_argument("--set_address_2agent",             help = 'Set address to Agent',          action='append', nargs='*')
parser.add_argument("--set_power_off",                  help = 'Set power off',                 action='append', nargs='*')
parser.add_argument("--set_timeout",                    help = "Set timeout",                   action='append', nargs='*')
parser.add_argument("--set_local_time",                 help = "Set local time",                action='append', nargs='*')
parser.add_argument("--set_time_format",                help = "Set time format",               action='append', nargs='*')
parser.add_argument("--set_expected_firmware_version",  help = "Set expected firmware version", action='append', nargs='*')
parser.add_argument("--write_asserts",                  help = "Write asserts",                 action='append', nargs='*')
parser.add_argument("--write_firmware",                 help = "Write firmware",                action='append', nargs='*')
parser.add_argument("--set_langid",                     help = "Set langid",                    action='append', nargs='*')
parser.add_argument("--set_room_size",                  help = "Set room size",                 action='append', nargs='*')
parser.add_argument("--set_room_equipments",            help = "Set room equipments",           action='append', nargs='*')
parser.add_argument("--set_access_right",               help = "Set access right",              action='append', nargs='*')
parser.add_argument("--set_hardware_feature",           help = "Set hardware feature",          action='append', nargs='*')
parser.add_argument("--set_backlight",                  help = "Set backlight",                 action='append', nargs='*')
parser.add_argument("--set_room_name",                  help = "Set room name",                 action='append', nargs='*')
parser.add_argument("--set_timeline",                   help = "Set timeline",                  action='append', nargs='*')
parser.add_argument("--on_extend_meeting",              help = "Extend meeting",                action='append', nargs='*')
parser.add_argument("--on_add_meeting",                 help = "Add meeting",                   action='append', nargs='*')
parser.add_argument("--on_del_meeting",                 help = "Delete meeting",                action='append', nargs='*')
parser.add_argument("--on_update_meeting",              help = "Update meeting",                action='append', nargs='*')
parser.add_argument("--set_meeting_info",               help = "Set meeting info",              action='append', nargs='*')
parser.add_argument("--set_meeting_body",               help = "Set meeting body",              action='append', nargs='*')
parser.add_argument("--set_error_code",                 help = "Set error code",                action='append', nargs='*')
parser.add_argument("--get_uuid",                       help = "Get uuid",                      action='append', nargs='*')
parser.add_argument("--set_unconfigured_id",            help = "Set unconfigured id",           action='append', nargs='*')
parser.add_argument("--set_panel_power",                help = "Set panel power",               action='append', nargs='*')
parser.add_argument("--cmd_set_attr",                   help = "Cmd set attr",                  action='append', nargs='*')

def getCMDCode(cmd):
    return  { \
                "SET_ADDRESS_2AGENT": 0,
                "SET_POWER_OFF": 1,
                "SET_TIMEOUT": 2,
                "SET_LOCAL_TIME": 3,
                "SET_TIME_FORMAT": 4,
                "SET_EXPECTED_FIRMWARE_VERSION": 5,
                "WRITE_ASSERTS": 6,
                "WRITE_FIRMWARE": 7,
                "SET_LANGID": 8,
                "SET_ROOM_SIZE": 9,
                "SET_ROOM_EQUIPMENTS": 10,
                "SET_ACCESS_RIGHT": 11,
                "SET_HARDWARE_FEATURE": 12,
                "SET_BACKLIGHT": 13,
                "SET_ROOM_NAME": 14,
                "SET_TIMELINE": 15,

                "ON_EXTEND_MEETING": 16,
                "ON_ADD_MEETING": 17,
                "ON_DEL_MEETING": 18,
                "ON_UPDATE_MEETING": 19,

                "SET_MEETING_INFO": 20,
                "SET_MEETING_BODY": 21,
                "SET_ERROR_CODE": 22,
                "GET_UUID": 23,
                "SET_UNCONFIGURED_ID": 24,
                "SET_PANEL_POWER": 25,
                "CMD_SET_ATTR": 26
            }[cmd]

def packStringToBinary(str_data):
    val = 0
    pack_str = ""
    for c in str_data:
        val = ord(c)
        pack_str = pack_str + pack('B', val)
    return pack_str

def unpackBinaryToString(bin_data):
    unpack_str = ""
    for b in bin_data:
        val = unpack('B', b)
        n = val[0]
        unpack_str = unpack_str + str(format(n, '#02x')) + " "
    unpack_str = unpack_str.strip()
    return unpack_str

def unpackBinaryToList(bin_data):
    data_list = []
    for b in bin_data:
        unpack_str = ""
        val = unpack('B', b)
        n = val[0]
        unpack_str = str(format(n, '#02x'))
        data_list.append(unpack_str)
    return data_list

def paserUUIDFromString(str_uuid):
    # Assume that the UUID input string is XX:XX:XX:XX:XX:XX:XX:XX
    uuid_list = [""]
    uuid_list = str_uuid.split(":")
    return uuid_list

def dumpCMDMessage(cmdmsg):
    print ""
    print "CMD message's contents will be sent"
    print "\tVersion   : " + str(format(cmdmsg.ver, '#08x'))
    print "\tDst MAC   : " + str(cmdmsg.dstMAC)
    print "\tHub CMD   : " + str(cmdmsg.hubCMD)
    print "\tLength    : " + str(cmdmsg.length)
    print "\tAgent UUID: " + '[{}]'.format(':'.join(format(x, '02x') for x in cmdmsg.agentUUID))
    print "\tData      : " + unpackBinaryToString(cmdmsg.data)

def loadAgentUUIDFromJson(agent_idx):
    uuid = [0] * 8
    # Assume that agent_idx is the index of Agent UUID in list
    agent_uuid_list = {}
    uuid_str = ""
    try:
        with open('agent_uuid_list.json') as json_file:
            agent_uuid_list = json.load(json_file)
    except:
        print "Agent list file could not be loaded. Please run --get_uuid to get agent uuid list from HUB"
        return False
    idx = 0

    if len(agent_uuid_list['agent_uuid_list']) < agent_idx:
        print 'Number of agent UUID: ' + str(len(agent_uuid_list['agent_uuid_list']))
        print 'Slected agent UUID index grather than number of agent UUID'
        return False

    for agent in agent_uuid_list['agent_uuid_list']:
        idx = idx + 1
        if idx == int(agent_idx):
            uuid_str = agent['agent_uuid']
            uuid_str = uuid_str.split(":")
            for i in range(0, 8):
                uuid[i] = int(uuid_str[i], 16)
            return uuid

    return False

def sendCMDMessage(msg):
    global MRBS_CMD_MSG
    try:
        # Packing data
        MRBS_CMD_MSG.data = msg
        cmd_msg = MRBS_CMD_MSG.packData()
        dumpCMDMessage(MRBS_CMD_MSG)
        print "\tPackage data: " + unpackBinaryToString(cmd_msg)
        # Set a timeout value of 1 second
        HUB_SOCKET.settimeout(1)
        hub_address = (HUB_HOST, int(HUB_PORT))
        # Sending data to MRBS HUB
        HUB_SOCKET.sendto(cmd_msg, hub_address)

        return True
    except:
        print 'ERROR:\tCannot Send data to MRBS agent'
        return False

def paserArguments():
    global parser
    global HUB_HOST
    global HUB_PORT
    global CMD_DATA

    arg = 0
    try:
        arg = parser.parse_args()
    except:
        # print 'ERROR:\tIncorrect argument'
        # parser.print_help()
        exit(-1)

    if arg.p:
        HUB_PORT = int(arg.p[0])

    if arg.i:
        HUB_HOST = arg.i[0]

    if arg.a:
        uuid = loadAgentUUIDFromJson(int(arg.a[0]))
        if uuid != False:
            AGENT_UUID = uuid
            MRBS_CMD_MSG.agentUUID = AGENT_UUID

    if arg.m:
        MRBS_CMD_MSG.dstMAC = int(arg.m[0])

    print "MRBS HUB port address: " + str(HUB_PORT)
    print "MRBS HUB IP address  : " + HUB_HOST

    if arg.set_address_2agent:
        Set_Address_2agent(arg.set_address_2agent)

    if arg.set_power_off:
        Set_Power_Off(arg.set_power_off)

    if arg.set_timeout:
        Set_Timeout(arg.set_timeout)

    if arg.set_local_time:
        Set_Local_Time(arg.set_local_time)

    if arg.set_time_format:
        Set_Time_Format(arg.set_time_format)

    if arg.set_expected_firmware_version:
        Set_Expected_Firmware_Version(arg.set_expected_firmware_version)

    if arg.write_asserts:
        Write_Asserts(arg.write_asserts)

    if arg.write_firmware:
        Write_Firmware(arg.write_firmware)

    if arg.set_langid:
        Set_Langid(arg.set_langid)

    if arg.set_room_size:
        Set_Room_Size(arg.set_room_size)

    if arg.set_room_equipments:
        Set_Room_Equipments(arg.set_room_equipments)

    if arg.set_access_right:
        Set_Access_Right(arg.set_access_right)

    if arg.set_hardware_feature:
        Set_Hardware_Feature(arg.set_hardware_feature)

    if arg.set_backlight:
        Set_Backlight(arg.set_backlight)

    if arg.set_room_name:
        Set_Room_Name(arg.set_room_name)

    if arg.set_timeline:
        Set_Timeline(arg.set_timeline)

    if arg.on_extend_meeting:
        On_Extend_Meeting(arg.on_extend_meeting)

    if arg.on_add_meeting:
        On_Add_Meeting(arg.on_add_meeting)

    if arg.on_del_meeting:
        On_Del_Meeting(arg.on_del_meeting)

    if arg.on_update_meeting:
        On_Update_Meeting(arg.on_update_meeting)

    if arg.set_meeting_info:
        Set_Meeting_Info(arg.set_meeting_info)

    if arg.set_meeting_body:
        Set_Meeting_Body(arg.set_meeting_body)

    if arg.set_error_code:
        Set_Error_Code(arg.set_error_code)

    if arg.get_uuid:
        Get_Uuid(arg.get_uuid)

    if arg.set_unconfigured_id:
        Set_Unconfigured_Id(arg.set_unconfigured_id)

    if arg.set_panel_power:
        Set_Panel_Power(arg.set_panel_power)

    if arg.cmd_set_attr:
        Cmd_Set_Attr(arg.cmd_set_attr)
    return

# Set expected firmware virsion CMD format: 
# --set_expected_firmware_version hex_version
# Eg:   --set_expected_firmware_version 0x1234
def Set_Expected_Firmware_Version(arg):
    arg_list = arg[0]
    fir_ver = 0x00
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "--set_expected_firmware_version hex_version"
            print "\tEg:   --set_expected_firmware_version 0x1234"
            return

        # run with user configuration
        if len(arg_list) == 1:
            fir_ver = int(arg_list[0], 16)
        else:
            print "ERROR:\tInvalid timeout value"
            return
    else:
        # run with default configuration in json file
        fir_ver = int(CMD_DEFAULT_DATA_JSON['set_expected_firmware_version'], 16)

    cmd_id = pack('B', getCMDCode('SET_EXPECTED_FIRMWARE_VERSION'))
    bin_data = pack('H', fir_ver)
    msg = cmd_id + bin_data
    sendCMDMessage(msg)
    return

# Set Address to Agent CMD format: --set_address_2agent addr
# Eg:   --set_address_2agent 123
def Set_Address_2agent(arg):
    arg_list = arg[0]
    mstp_address = 0
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "--set_address_2agent addr"
            print "\tEg:   --set_address_2agent 123"
            return
        if len(arg_list) == 1:
            # run with user configuration
            mstp_address = int(arg_list[0])
            if mstp_address > 255:
                print "ERROR:\tInvalid MSTP Address"
                return
        else:
            print "ERROR:\tInvalid MSTP Address"
            return
    else:
        # run with default configuration in json file
        mstp_address = int(CMD_DEFAULT_DATA_JSON['set_address_2agent'])

    cmd_id = pack('B', getCMDCode('SET_ADDRESS_2AGENT'))
    bin_data = pack('B', mstp_address)
    msg = cmd_id + bin_data
    sendCMDMessage(msg)
    print "Set address to agent: ", mstp_address
    return

# Set power off CMD format: --set_power_off on/off/1/0
def Set_Power_Off(arg):
    arg_list = arg[0]
    power_status = 0

    if len(arg_list) > 0:
        if arg_list[0] == 'help':
            print ""
            print "--set_power_off on/off/1/0"
            print "\tEg:   --set_power_off on"
            return
        if len(arg_list) == 1:
            if arg_list[0] == 'on' or arg_list[0] == '1':
                power_status = 1
            else:
                # run with default configuration in json file
                power_status = 0
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        power_status = int(CMD_DEFAULT_DATA_JSON['set_power_off'])

    cmd_id = pack('B', getCMDCode('SET_POWER_OFF'))
    bin_data = pack('B', power_status)
    msg = cmd_id + bin_data
    sendCMDMessage(msg)
    print "Set power off: ", power_status
    return

# Set timeout CMD format: --set_timeout second_time
# Eg: --set_timeout 100
def Set_Timeout(arg):
    arg_list = arg[0]

    if len(arg_list) > 0:
        if arg_list[0] == 'help':
            print ""
            print "--set_timeout second_time"
            print "\tEg:   --set_timeout 100"
            return
        if len(arg_list) == 1:
            # run with user configuration
            time_out = int(arg_list[0])
            if time_out > 255:
                print "ERROR:\tInvalid timeout value"
                return
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        time_out = int(CMD_DEFAULT_DATA_JSON['set_timeout'])

    cmd_id = pack('B', getCMDCode('SET_TIMEOUT'))
    bin_data = pack('B', time_out)
    msg = cmd_id + bin_data
    sendCMDMessage(msg)
    # print "Set Timeout: ", time_out
    return

# Argument format: --set_local_time seconds_of_day day month year
def Set_Local_Time(arg):
    arg_list = arg[0]
    sec_of_day = 0
    day = 0
    month = 0
    year = 0
    time = 0x00000000

    if len(arg_list) > 0:
        if arg_list[0] == 'help':
            print ""
            print "--set_local_time seconds_of_day day month year"
            print "\tEg:   --set_local_time 100 10 12 17"
            return
        if len(arg_list) == 4:
            # run with user configuration
            sec_of_day = int(arg_list[0])
            day        = int(arg_list[1])
            month      = int(arg_list[2])
            year       = int(arg_list[3])
            if sec_of_day > 0x1ffff or day > 0x1f or month > 0x0f or year > 0x3f:
                print "ERROR:\tInvalid input times"
                return
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        sec_of_day = int(CMD_DEFAULT_DATA_JSON['set_local_time']['seconds_of_day'])
        day        = int(CMD_DEFAULT_DATA_JSON['set_local_time']['day'])
        month      = int(CMD_DEFAULT_DATA_JSON['set_local_time']['month'])
        year       = int(CMD_DEFAULT_DATA_JSON['set_local_time']['year'])

    time = sec_of_day & 0x1ffff
    time = time | ((day << 17) & 0x003e0000)
    time = time | ((month << (17 + 5)) & 0x03c00000)
    time = time | ((year << (17 + 5 +4)) & 0xfc000000)

    cmd_id = pack('B', getCMDCode('SET_LOCAL_TIME'))
    bin_data = pack('I',time)
    msg = cmd_id + bin_data
    sendCMDMessage(msg)
    print "Time: sec of day: " + str(sec_of_day) + " - day: " + str(day) + " - month: " + str(month) + " - year: " + str(year)
    print "Time value will be sent: " + str(time) + " hex: " + str(format(time, '#08x'))
    return

# Set time format: --set_time_format standard/military/s/m
def Set_Time_Format(arg):
    arg_list = arg[0]
    time_format = 0
    time_format_str = "standard"

    if len(arg_list) > 0:
        if arg_list[0] == 'help':
            print ""
            print "--set_time_format standard/military/s/m"
            print "\tEg:   --set_time_format standard"
            return
        if len(arg_list) == 1:
            # run with user configuration
            if arg_list[0] == 'standard' or arg_list[0] == 's':
                time_format = 0
                time_format_str = 'standard'
            elif arg_list[0] == 'military' or arg_list[0] == 'm':
                time_format = 1
                time_format_str = 'military'
            else:
                print "ERROR:\tInvalid time format"
                return
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        time_format = int(CMD_DEFAULT_DATA_JSON['set_time_format']['standard_time'])
    
    cmd_id = pack('B', getCMDCode('SET_TIME_FORMAT'))
    bin_data = pack('B', time_format)
    msg = cmd_id + bin_data
    sendCMDMessage(msg)
    # print "Set time format: " + time_format_str
    return

# Write asserts cmd format: --write_assert path_len path data_len data
#Eg:    --write_assert 14 /Document/file 19 'This is assert data'
#Eg:    --write_assert /Document/file 'This is assert data'
def Write_Asserts(arg):
    arg_list = arg[0]
    path_len = 0
    path = ""
    data_len = 0
    data = ""

    if len(arg_list) > 0:
        if arg_list[0] == 'help':
            print ""
            print "Write asserts cmd format: --write_assert path_len path data_len data"
            print "\tEg:    --write_assert 14 /Document/file 19 'This is assert data'"
            print "\tEg:    --write_assert /Document/file 'This is assert data'"
            return
        if len(arg_list) == 4:
            # run with user configuration
            path_len = int(arg_list[0])
            path     = arg_list[1]
            data_len = int(arg_list[2])
            data     = arg_list[3]
        elif len(arg_list) == 2:
            path_len = len(arg_list[0])
            path     = arg_list[0]
            data_len = len(arg_list[1])
            data     = arg_list[1]
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        path_len = int(CMD_DEFAULT_DATA_JSON['write_asserts']['path_len'])
        path     = CMD_DEFAULT_DATA_JSON['write_asserts']['path']
        data_len = int(CMD_DEFAULT_DATA_JSON['write_asserts']['data_len'])
        data     = CMD_DEFAULT_DATA_JSON['write_asserts']['data']

    cmd_id = pack('B', getCMDCode('WRITE_ASSERTS'))
    path_len_bin = pack('B', path_len)
    data_len_bin = pack('B', data_len)
    path_bin = packStringToBinary(path)
    data_bin = packStringToBinary(data)
    msg = cmd_id + path_len_bin + path_bin + data_len_bin + data_bin
    # print "path: len[" + str(path_len) + "] : " + path
    # print "data: len[" + str(data_len) + "] : " + data
    sendCMDMessage(msg)
    return

# Write firmware CMD format: --wirte_firmware data_len data
def Write_Firmware(arg):
    arg_list = arg[0]
    data_len = 0
    data = ""
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Write firmware CMD format: --wirte_firmware data_len data"
            return
        # run with user configuration
        if len(arg_list) == 2:
            data_len = int(arg_list[0])
            data = arg_list[1]
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        data_len = int(CMD_DEFAULT_DATA_JSON['write_firmware']['data_len'])
        data = CMD_DEFAULT_DATA_JSON['write_firmware']['data']
    cmd_id = pack('B', getCMDCode('WRITE_FIRMWARE'))
    fir_bin = packStringToBinary(data)
    msg = cmd_id + fir_bin
    sendCMDMessage(msg)
    return

# Set language ID CMD format: --set_langid id
def Set_Langid(arg):
    arg_list = arg[0]
    langid = 0
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set language ID CMD format: --set_langid id"
            print "\tEg:   --set_langid 1"
            return
        # run with user configuration
        if len(arg_list) == 1:
            langid = int(arg_list[0])
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        langid = int(CMD_DEFAULT_DATA_JSON['set_langid'])
    cmd_id = pack('B', getCMDCode('SET_LANGID'))
    bin_data = pack('B', langid)
    msg = cmd_id + bin_data
    sendCMDMessage(msg)
    # print "Set language ID: ", langid
    return

# Set room size CMD format: --set_room_size people
# Eg:   --set_room_size 100
def Set_Room_Size(arg):
    arg_list = arg[0]
    max_people = 0
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set room size CMD format: --set_room_size people"
            print "\tEg:   --set_room_size 100"
            return
        # run with user configuration
        if len(arg_list) == 1:
            max_people = int(arg_list[0])
            if max_people > 0xffff:
                print "ERROR:\tInvalid number of people"
                return
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        max_people = int(CMD_DEFAULT_DATA_JSON['set_room_size'])

    cmd_id = pack('B', getCMDCode('SET_ROOM_SIZE'))
    bin_data = pack('H', max_people)
    msg = cmd_id + bin_data
    sendCMDMessage(msg)
    print "Set room size: ", max_people
    return

# Set room equipments CMD format: --set_room_equipments pr vi au tv la pc
def Set_Room_Equipments(arg):
    arg_list = arg[0]
    project = 0
    video_conference = 0
    audio_conference = 0
    tv = 0
    laptop = 0
    pc = 0
    reserved = 2
    bit_idx = 0

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set room equipments CMD format: --set_room_equipments pr vi au tv la pc"
            print "\tEg:   --set_room_equipments pr  Note: this command will enable project for room"
            return
        # run with user configuration
        if len(arg_list) <= 6:
            for e in arg_list:
                if e == 'pr':
                    project = 1
                elif e == 'vi':
                    video_conference = 1
                elif e == 'au':
                    audio_conference = 1
                elif e == 'tv':
                    tv = 1
                elif e == 'la':
                    laptop = 1
                elif e == 'pc':
                    pc = 1
                else:
                    print "ERROR:\tInvalid argument"
                    return
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
            project          = int(CMD_DEFAULT_DATA_JSON['set_room_equipments']['project'])
            video_conference = int(CMD_DEFAULT_DATA_JSON['set_room_equipments']['video_conference'])
            audio_conference = int(CMD_DEFAULT_DATA_JSON['set_room_equipments']['audio_conference'])
            tv               = int(CMD_DEFAULT_DATA_JSON['set_room_equipments']['tv'])
            laptop           = int(CMD_DEFAULT_DATA_JSON['set_room_equipments']['laptop'])
            pc               = int(CMD_DEFAULT_DATA_JSON['set_room_equipments']['pc'])

    equipments = (project & 1) 
    equipments = equipments | ((video_conference << 1) & (1 << 1))
    equipments = equipments | ((audio_conference << 2) & (1 << 2))
    equipments = equipments | ((tv << 3) & (1 << 3))
    equipments = equipments | ((laptop << 4) & (1 << 4))
    equipments = equipments | ((pc << 5) & (1 << 5))

    cmd_id = pack('B', getCMDCode('SET_ROOM_EQUIPMENTS'))
    data_bin = pack('B', equipments) # pack to 1 byte
    # data_bin = pack('I', equipments) # pack to 4 bytes
    msg = cmd_id + data_bin
    sendCMDMessage(msg)
    return

# Set access right CMD format: --set_access_right ex cl ca os en au
#   ex: disable extend meeting
#   cl: disable claim meeting
#   ca: disable cancel meeting
#   fu: disable future booking
#   os: disable on spot booking
#   en: disable end meeting
#   au: disable authenticate
def Set_Access_Right(arg):
    arg_list = arg[0]
    disable_extend_meeting = 0
    disable_claim_meeting = 0
    disable_cancel_meeting = 0
    disable_future_booking = 0
    disable_on_spot_booking = 0
    disable_end_meeting = 0
    disable_auth = 0

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set access right CMD format: --set_access_right ex cl ca os en au"
            print "  ex: disable extend meeting"
            print "  cl: disable claim meeting"
            print "  ca: disable cancel meeting"
            print "  fu: disable future booking"
            print "  os: disable on spot booking"
            print "  en: disable end meeting"
            print "  au: disable authenticate"
            return
        # run with user configuration
        if len(arg_list) <= 7:
            for d in arg_list:
                if d == 'ex':
                    disable_extend_meeting = 1
                elif d == 'cl':
                    disable_claim_meeting = 1
                elif d == 'ca':
                    disable_cancel_meeting = 1
                elif d == 'fu':
                    disable_future_booking = 1
                elif d == 'os':
                    disable_on_spot_booking = 1
                elif d == 'en':
                    disable_end_meeting = 1
                elif d == 'au':
                    disable_auth = 1
                else:
                    print "ERROR:\tInvalid argument"
                    return
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        disable_extend_meeting  = int(CMD_DEFAULT_DATA_JSON['set_access_right']['disable_extend_meeting'])
        disable_claim_meeting   = int(CMD_DEFAULT_DATA_JSON['set_access_right']['disable_claim_meeting'])
        disable_cancel_meeting  = int(CMD_DEFAULT_DATA_JSON['set_access_right']['disable_cancel_meeting'])
        disable_future_booking  = int(CMD_DEFAULT_DATA_JSON['set_access_right']['disable_future_booking'])
        disable_on_spot_booking = int(CMD_DEFAULT_DATA_JSON['set_access_right']['disable_on_spot_booking'])
        disable_end_meeting     = int(CMD_DEFAULT_DATA_JSON['set_access_right']['disable_end_meeting'])
        disable_auth            = int(CMD_DEFAULT_DATA_JSON['set_access_right']['disable_auth'])

    access_right = (disable_extend_meeting & 1)
    access_right = access_right | (disable_claim_meeting << 1)
    access_right = access_right | (disable_cancel_meeting << 2)
    access_right = access_right | (disable_future_booking << 3)
    access_right = access_right | (disable_on_spot_booking << 4)
    access_right = access_right | (disable_end_meeting << 5)
    access_right = access_right | (disable_auth << 6)

    cmd_id = pack('B', getCMDCode('SET_ACCESS_RIGHT'))
    data_bin = pack('B', access_right) # pack to 1 byte
    # data_bin = pack('I', access_right) # pack to 4 bytes
    msg = cmd_id + data_bin
    sendCMDMessage(msg)
    return

# Set hardware feature CMD format: --set_hardware_feature mute led_off rfid_off
def Set_Hardware_Feature(arg):
    arg_list = arg[0]
    mute = 0
    led_off = 0
    rfid_off = 0

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set hardware feature CMD format: --set_hardware_feature mute led_off rfid_off"
            print "\tEg:   --set_hardware_feature mute   Note: This command will enable mute feature"
            return
        # run with user configuration
        if len(arg_list) <= 3:
            for f in arg_list:
                if f == 'mute':
                    mute = 1
                elif f == 'led_off':
                    led_off = 1
                elif f == 'rfid_off':
                    rfid_off = 1
                else:
                    print "ERROR:\tInvalid argument"
                    return
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        mute     = int(CMD_DEFAULT_DATA_JSON['set_hardware_feature']['mute'])
        led_off  = int(CMD_DEFAULT_DATA_JSON['set_hardware_feature']['led_off'])
        rfid_off = int(CMD_DEFAULT_DATA_JSON['set_hardware_feature']['rfid_off'])
    
    hw_feature = mute & 1
    hw_feature = hw_feature | (led_off << 1)
    hw_feature = hw_feature | (rfid_off << 2)

    cmd_id = pack('B', getCMDCode('SET_HARDWARE_FEATURE'))
    data_bin = pack('B', hw_feature)
    msg = cmd_id + data_bin
    sendCMDMessage(msg)
    return

# Set backlight CMD format: --set_backlight on/1/0 or --set_backlight
def Set_Backlight(arg):
    arg_list = arg[0]
    backlight = 0
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set backlight CMD format: --set_backlight on/off/1/0 or --set_backlight"
            return
        # run with user configuration
        if len(arg_list) == 1:
            if arg_list[0] == '1' or arg_list[0] == 'on':
                backlight = 1
            else:
                backlight = 0 
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        backlight = int(CMD_DEFAULT_DATA_JSON['set_backlight'])

    cmd_id = pack('B', getCMDCode('SET_BACKLIGHT'))
    data_bin = pack('B', backlight)
    msg = cmd_id + data_bin
    sendCMDMessage(msg)
    return

# Set room name CMD format: --set_room_name len room_name
# Eg:   --set_room_name 12 'Meeting room'
# Eg:   --set_room_name 'Meeting room'
def Set_Room_Name(arg):
    arg_list = arg[0]
    room_len = 0
    room_name = ""

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set room name CMD format: --set_room_name len room_name"
            print "\tEg:   --set_room_name 12 'Meeting room'"
            print "\tEg:   --set_room_name 'Meeting room'"
            return
        # run with user configuration
        if len(arg_list) == 2:
            room_len = int(arg_list[0])
            room_name = arg_list[1]
        elif len(arg_list) == 1:
            room_len = len(arg_list[0])
            room_name = arg_list[0]
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        room_len = int(CMD_DEFAULT_DATA_JSON['set_room_name']['room_name_length'])
        room_name = CMD_DEFAULT_DATA_JSON['set_room_name']['room_name']

    cmd_id = pack('B', getCMDCode('SET_ROOM_NAME'))
    room_len_bin = pack('B', room_len)
    room_name_bin = packStringToBinary(room_name)
    msg = cmd_id + room_len_bin + room_name_bin
    sendCMDMessage(msg)
    return

# Set timeline CMD format: --set_timeline day_offset count start_time end_time
# Eg:   --set_timeline 10 10 10 20
def Set_Timeline(arg):
    arg_list = arg[0]
    day_offset = 0
    count = 0
    start_time = []
    end_time = []

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set timeline CMD format: --set_timeline day_offset count start_time end_time"
            print "Eg:   --set_timeline 0 1 10 20"
            return
        # run with user configuration
        if len(arg_list) >= 4:
            if len(arg_list[2:]) % 2 != 0:
                print 'Invalid number of start time and end time'
                return

            day_offset = int(arg_list[0])
            count      = int(arg_list[1])

            for i in range(0, count):
                start_time_idx = 2 + i*2
                end_time_idx   = 2 + i*2 + 1
                start_time.append(int(arg_list[start_time_idx]))
                end_time.append(int(arg_list[end_time_idx]))
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        day_offset = int(CMD_DEFAULT_DATA_JSON['set_timeline']['day_offset'])
        count      = int(CMD_DEFAULT_DATA_JSON['set_timeline']['count'])
        for busy in CMD_DEFAULT_DATA_JSON['set_timeline']['busy']:
            start_time.append(int(busy['start_time']))
            end_time.append(int(busy['end_time']))

    cmd_id = pack('B', getCMDCode('SET_TIMELINE'))
    day_offset_bin = pack('B', day_offset)
    count_bin = pack('B', count)
    time = ""

    for i in range(0, count):
        start_time_bin = pack('H', start_time[i])
        end_time_bin = pack('H', end_time[i])
        time = time + start_time_bin + end_time_bin

    msg = cmd_id + day_offset_bin + count_bin + time
    sendCMDMessage(msg)
    return

# TODO: will be developed in future
def On_Move_Meeting(arg):
    arg_list = arg[0]
    previous_day_offset = 0 # 1 byte
    previous_start_time = 0 # 2 bytes
    now_day_offset = 0      # 1 byte
    now_start_time = 0      # 2 bytes
    duration = 0            # 2 bytes

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Help infomations"
            return
        # run with user configuration
        if len(arg_list) == 1:
            pass
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        pass
    return

# On extend meeting CMD format --on_extend_meeting <day_offset> <start_time> <new_duration>
# Eg:   --on_extend_meeting 12 1234 1000
def On_Extend_Meeting(arg):
    arg_list = arg[0]
    day_offset   = 0  # 1 byte
    start_time   = 0  # 2 bytes
    new_duration = 0  # 2 bytes

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "On extend meeting CMD format --on_extend_meeting <day_offset> <start_time> <new_duration>"
            print "Eg:   --on_extend_meeting 2 1234 1000"
            return
        # run with user configuration
        if len(arg_list) == 3:
            day_offset   = int(arg_list[0])
            start_time   = int(arg_list[1])
            new_duration = int(arg_list[2])
        else:
            print "ERROR:\tInvalid argument"
            print "On extend meeting CMD format --on_extend_meeting <day_offset> <start_time> <new_duration>"
            print "Eg:   --on_extend_meeting 2 1234 1000"
            return
    else:
        # run with default configuration in json file
        day_offset   = int(CMD_DEFAULT_DATA_JSON['on_extend_meeting']['day_offset'])
        start_time   = int(CMD_DEFAULT_DATA_JSON['on_extend_meeting']['start_time'])
        new_duration = int(CMD_DEFAULT_DATA_JSON['on_extend_meeting']['new_duration'])

    cmd_id = cmd_id = pack('B', getCMDCode('ON_EXTEND_MEETING'))
    day_offset_bin = pack('B', day_offset)
    start_time_bin = pack('H', start_time)
    new_duration_bin = pack('H', new_duration)
    msg = cmd_id + day_offset_bin + start_time_bin + new_duration_bin
    sendCMDMessage(msg)
    return

# On add meeting CMD format: --on_add_meeting <day_offset> <start_time> <duration>
# Eg:   --on_add_meeting 2 1234 1000
def On_Add_Meeting(arg):
    arg_list = arg[0]
    day_offset = 0    # 1 byte
    start_time = 0    # 2 bytes
    duration   = 0    # 2 bytes

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "On extend meeting CMD format --on_add_meeting <day_offset> <start_time> <duration>"
            print "Eg:   --on_add_meeting 2 1234 1000"
            return
        # run with user configuration
        if len(arg_list) == 3:
            day_offset   = int(arg_list[0])
            start_time   = int(arg_list[1])
            duration     = int(arg_list[2])
        else:
            print "ERROR:\tInvalid argument"
            print "On extend meeting CMD format --on_add_meeting <day_offset> <start_time> <duration>"
            print "Eg:   --on_add_meeting 2 1234 1000"
            return
    else:
        # run with default configuration in json file
        day_offset   = int(CMD_DEFAULT_DATA_JSON['on_add_meeting']['day_offset'])
        start_time   = int(CMD_DEFAULT_DATA_JSON['on_add_meeting']['start_time'])
        duration     = int(CMD_DEFAULT_DATA_JSON['on_add_meeting']['duration'])
    cmd_id = cmd_id = pack('B', getCMDCode('ON_ADD_MEETING'))
    day_offset_bin = pack('B', day_offset)
    start_time_bin = pack('H', start_time)
    duration_bin = pack('H', duration)
    msg = cmd_id + day_offset_bin + start_time_bin + duration_bin
    sendCMDMessage(msg)
    return

# On delete meeting CMD format: --on_del_meeting  <day_offset> <start_time>
# --on_del_meeting  12 1234
def On_Del_Meeting(arg):
    arg_list = arg[0]
    day_offset = 0    # 1 byte
    start_time = 0    # 2 bytes

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "On delete meeting CMD format: --on_del_meeting  <day_offset> <start_time>"
            print "Eg:    --on_del_meeting  12 1234"
            return
        # run with user configuration
        if len(arg_list) == 2:
            day_offset   = int(arg_list[0])
            start_time   = int(arg_list[1])
        else:
            print "ERROR:\tInvalid argument"
            print "On delete meeting CMD format: --on_del_meeting  <day_offset> <start_time>"
            print "Eg:    --on_del_meeting  12 1234"
            return
    else:
        # run with default configuration in json file
        day_offset   = int(CMD_DEFAULT_DATA_JSON['on_del_meeting']['day_offset'])
        start_time   = int(CMD_DEFAULT_DATA_JSON['on_del_meeting']['start_time'])
    cmd_id = cmd_id = pack('B', getCMDCode('ON_DEL_MEETING'))
    day_offset_bin = pack('B', day_offset)
    start_time_bin = pack('H', start_time)
    msg = cmd_id + day_offset_bin + start_time_bin
    sendCMDMessage(msg)
    return

# On update meeting CMD format: --on_update_meeting  <day_offset> <start_time>
# --on_update_meeting  12 1234
def On_Update_Meeting(arg):
    arg_list = arg[0]
    day_offset = 0     # 1 byte
    start_time = 0     # 2 bytes

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "On delete meeting CMD format: --on_update_meeting  <day_offset> <start_time>"
            print "Eg:    --on_update_meeting  12 1234"
            return
        # run with user configuration
        if len(arg_list) == 2:
            day_offset   = int(arg_list[0])
            start_time   = int(arg_list[1])
        else:
            print "ERROR:\tInvalid argument"
            print "On delete meeting CMD format: --on_update_meeting  <day_offset> <start_time>"
            print "Eg:    --on_update_meeting  12 1234"
            return
    else:
        # run with default configuration in json file
        day_offset   = int(CMD_DEFAULT_DATA_JSON['on_update_meeting']['day_offset'])
        start_time   = int(CMD_DEFAULT_DATA_JSON['on_update_meeting']['start_time'])
    cmd_id = cmd_id = pack('B', getCMDCode('ON_UPDATE_MEETING'))
    day_offset_bin = pack('B', day_offset)
    start_time_bin = pack('H', start_time)
    msg = cmd_id + day_offset_bin + start_time_bin
    sendCMDMessage(msg)
    return

# Set meeting info CMD format: --set_meeting_info subject_lenght oganizer_length utf8_string
# Eg:   --set_meeting_info 10 10 "Love Cafe Tri Truong"
def Set_Meeting_Info(arg):
    arg_list = arg[0]
    subject_lenght = 0
    oganizer_length = 0
    utf8_string = ""

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print "Set meeting info CMD format: --set_meeting_info subject_lenght oganizer_length utf8_string"
            print "\tEg:   --set_meeting_info 10 10 \"Love Cafe Tri Truong\""
            return
        # run with user configuration
        if len(arg_list) == 3:
            subject_lenght  = int(arg_list[0])
            oganizer_length = int(arg_list[1])
            utf8_string     = arg_list[2]
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        subject_lenght  = int(CMD_DEFAULT_DATA_JSON['set_meeting_info']['subject_lenght'])
        oganizer_length = int(CMD_DEFAULT_DATA_JSON['set_meeting_info']['oganizer_length'])
        utf8_string     = CMD_DEFAULT_DATA_JSON['set_meeting_info']['utf8']

    cmd_id = pack('B', getCMDCode('SET_MEETING_INFO'))
    subject_lenght_bin = pack('B', subject_lenght)
    oganizer_length_bin = pack('B', oganizer_length)
    utf8_string_bin = packStringToBinary(utf8_string)
    msg = cmd_id + subject_lenght_bin + oganizer_length_bin + utf8_string_bin
    sendCMDMessage(msg)
    return

# Set meeting body CMD format: --set_meeting_body body_len utf8_str
# Eg:   --set_meeting_body 27 "Cafe is good for programmer"
# Eg:   --set_meeting_body "Cafe is good for programmer"
def Set_Meeting_Body(arg):
    arg_list = arg[0]
    body_length = 0
    body_info = ""

    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set meeting body CMD format: --set_meeting_body body_len utf8_str"
            print "Eg:   --set_meeting_body 27 \"Cafe is good for programmer\""
            print "Eg:   --set_meeting_body \"Cafe is good for programmer\""
            return
        # run with user configuration
        if len(arg_list) == 2:
            body_length = int(arg_list[0])
            body_info   = arg_list[1]
        elif len(arg_list) == 1:
            body_length = len(arg_list[0])
            body_info   = arg_list[0]
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        body_length = int(CMD_DEFAULT_DATA_JSON['set_meeting_body']['body_length'])
        body_info   = CMD_DEFAULT_DATA_JSON['set_meeting_body']['utf8']

    cmd_id = pack('B', getCMDCode('SET_MEETING_BODY'))
    body_length_bin = pack('B', body_length)
    body_info_bin = packStringToBinary(body_info)
    msg = cmd_id + body_length_bin + body_info_bin
    sendCMDMessage(msg)
    return

# Set error code CMD format: --set_error_code error_code
#Eg:    --set_error_code 255
def Set_Error_Code(arg):
    arg_list = arg[0]
    error_code = 0
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Set error code CMD format: --set_error_code error_code"
            print "\tEg:    --set_error_code 255"
            return
        # run with user configuration
        if len(arg_list) == 1:
            error_code = int(arg_list[0])
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        error_code = int(CMD_DEFAULT_DATA_JSON['set_error_code'])

    cmd_id = pack('B', getCMDCode('SET_ERROR_CODE'))
    error_code_bin = pack('B', error_code)
    msg = cmd_id + error_code_bin
    sendCMDMessage(msg)
    return

# Get Agent UUID CMD format: --get_uuid
def Get_Uuid(arg):
    arg_list = arg[0]
    MRBS_CMD_MSG.hubCMD = MRBS_CMD_MSG.HUB_CMD_GET_AGENT_LIST
    cmd_id = pack('B', getCMDCode("GET_UUID"))
    sendCMDMessage(cmd_id)
    HUB_SOCKET.settimeout(5)

    try:
        rx_data, server_addr = HUB_SOCKET.recvfrom(1024)
    except:
        print 'Could not be recived data from HUB'
        return False
    # Unpack binary data
    rx_frame = unpackBinaryToList(rx_data)
    # Remove header
    uuid_arr = rx_frame[MRBS_CMD_MSG.HEADER_SIZE:]

    if len(uuid_arr) < 8 or (len(uuid_arr) % 8) != 0:
        print "Received UUID from HUB is not valid"
        return False

    uuid_list = []
    uuid_dict = {}
    agent_uuid = {}
    idx = 0
    for i in range(0, len(uuid_arr), 8):
        idx = idx + 1
        str_uuid = ""
        for j in range(i, i + 8):
            hex_val = int(uuid_arr[j], 16)
            hex_val = format(hex_val, '02x')
            if (j % 8) != 7:
                str_uuid = str_uuid + str(hex_val) + ':' 
            else:
                str_uuid = str_uuid + str(hex_val)

        uuid_dict['agent_uuid'] = str_uuid
        uuid_list.append(uuid_dict.copy())
        print 'Agent UUID [' + str(idx) + ']: ' + str_uuid

    agent_uuid['agent_uuid_list'] = uuid_list
    with open('agent_uuid_list.json', 'w') as outfile:
        json.dump(agent_uuid, outfile)

    return

# Set unconfigured ID CMD format: --set_unconfigured_id id
# Eg:   --set_unconfigured_id 1234
def Set_Unconfigured_Id(arg):
    arg_list = arg[0]
    id_unconfig = 0
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print "Set unconfigured ID CMD format: --set_unconfigured_id id"
            print "\tEg:   --set_unconfigured_id 1234"
            return
        # run with user configuration
        if len(arg_list) == 1:
            id_unconfig = int(arg_list[0])
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        id_unconfig = int(CMD_DEFAULT_DATA_JSON['set_unconfigured_id'])
    
    cmd_id = pack('B', getCMDCode('SET_UNCONFIGURED_ID'))
    id_unconfig_bin = pack('H', id_unconfig)
    msg = cmd_id + id_unconfig_bin
    sendCMDMessage(msg)
    return

def Set_Panel_Power(arg):
    arg_list = arg[0]
    print "Will be supported in furture"
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Will be supported in furture"
            return
        # run with user configuration
        if len(arg_list) == 1:
            pass
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        pass
    return

def Cmd_Set_Attr(arg):
    arg_list = arg[0]
    print "Will be supported in furture"    
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Help infomations"
            return
        # run with user configuration
        if len(arg_list) == 1:
            pass
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        pass
    return

def Demo_paser_cmd(arg):
    arg_list = arg[0]
    if len(arg_list) > 0:
        # Show help
        if arg_list[0] == 'help':
            print ""
            print "Help infomations"
            return
        # run with user configuration
        if len(arg_list) == 1:
            pass
        else:
            print "ERROR:\tInvalid argument"
            return
    else:
        # run with default configuration in json file
        pass
    return

def main():
    print "============================================================="
    print "=                  EMULATOR CMD SCRIPT                      ="
    print "=                      Version: 1.0                         ="
    print "============================================================="
    paserArguments()
    pass

if __name__ == '__main__':
    main()
    print ""
    print "End testing"
