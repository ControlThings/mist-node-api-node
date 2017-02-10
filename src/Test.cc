#include "Test.h"
#include "Mist.h"
#include "Message.h"
#include <string>

using namespace std;

static void* inst;

void Test::send(uint8_t* buf, int len) {
    //printf("sending sending... %p buf: %p len: %i\n", inst, buf, len);
    Mist* e = (Mist*) inst;

    string a = "even";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) buf, len);
    
    e->sendToNode(msg);
}

void Test::sendSandboxed(uint8_t* buf, int len) {
    //printf("sending sending... %p buf: %p len: %i\n", inst, buf, len);
    Mist* e = (Mist*) inst;

    string a = "sandboxed";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) buf, len);
    
    e->sendToNode(msg);
}

void Test::write(uint8_t* buf, int len) {
    //printf("sending sending... %p buf: %p len: %i\n", inst, buf, len);
    Mist* e = (Mist*) inst;

    string a = "write";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) buf, len);
    
    e->sendToNode(msg);
}

void Test::invoke(uint8_t* buf, int len) {
    //printf("sending sending... %p buf: %p len: %i\n", inst, buf, len);
    Mist* e = (Mist*) inst;

    string a = "invoke";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) buf, len);
    
    e->sendToNode(msg);
}

void Test::kill() {
    //printf("kill kill..\n");
    Mist* e = (Mist*) inst;

    string a = "done";
    string b = "dummy";
    
    Message msg(a, b, NULL, 0);
    
    e->sendToNode(msg);
}
