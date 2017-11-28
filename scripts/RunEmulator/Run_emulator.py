import subprocess
import thread
import time
import json
import os

# Load JSON file
CONFIGURATION_DATA = ""
with open('configurations.json') as json_file:
    CONFIGURATION_DATA = json.load(json_file)

PANL70_EMULATOR_DIR = CONFIGURATION_DATA['panl70_emulator_app_dir']
PANL_AGENT_DIR      = CONFIGURATION_DATA['agent_app_dir']
PANL_HUB_DIR        = CONFIGURATION_DATA['mrbs_hub_dir']

def execute_cmd(cmd):
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, shell=False)
    output = []
    for line in iter(proc.stdout.readline, ''):
        output += [line.rstrip()]
    proc.communicate()[0]
    proc.wait()
    return output

def execute_emulator(boardUUID, boardMAC, serverIP, serverPORT):
    CMD = PANL70_EMULATOR_DIR + " -i " + serverIP + " -p " + serverPORT + " -u " + boardUUID + " -m " + boardMAC
    print CMD + "\n"
    execute_cmd(CMD)

def execute_agent(mac, hub_ip, hub_port, bacnet_port):
    CMD = PANL_AGENT_DIR + " -m " + mac + " -p " + hub_port + " -s " + hub_ip + " -l " + bacnet_port
    print CMD
    execute_cmd(PANL_AGENT_DIR)

def excuete_panlhub():
    CMD = PANL_HUB_DIR
    execute_cmd(CMD)


def main():
    for agent in CONFIGURATION_DATA["agent"]:
        # Start MRBS Agent with configurations in json file
        panlagent = agent['agent_info']
        print "Start MRBS Agent: Hub Port: " + panlagent['hub_port'] + " - Hub IP: " + panlagent['hub_ip'] + " - Bacnet port: " + panlagent['bacnet_port'] + " - MAC: " + panlagent['mac']
        # thread.start_new_thread(execute_agent, (panlagent['mac'], panlagent['hub_ip'], panlagent['hub_port'], panlagent['bacnet_port']))
        time.sleep(0.05)
        # Start MRBS PanL70 Emulator with configurations in json file
        for panl70_info in agent['panl70_info']:
            print "Start PANL 70: MAC: " + panl70_info["mac"] + " - UUID: " + panl70_info["uuid"]
            thread.start_new_thread(execute_emulator, (panl70_info['uuid'], panl70_info['mac'], panlagent['hub_ip'], panlagent['bacnet_port']))
            time.sleep(0.05)

    # Start MRBS PanL HUB
    print "Start MRBS PanL HUB"
    # thread.start_new_thread(excuete_panlhub, ())
    time.sleep(0.05)

if __name__ == '__main__':
    main()
    time.sleep(2)
