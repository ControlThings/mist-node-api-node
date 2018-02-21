#include "Message.h"
#include "string.h"

using namespace std;

Message::Message(string name, uint8_t* m, int l) : name(name) {
    msg_len = l;
    msg = (uint8_t*) malloc(msg_len);
    
    if(!msg) {
        printf("Failed allocating memory for Message(.cc)\n");
        return;
    }
    
    memcpy(msg, m, msg_len);
}
    
Message::~Message() {
    //printf("Message::~Message: %p msg %p\n", this, msg);
}
