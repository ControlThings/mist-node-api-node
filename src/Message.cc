#include "Message.h"
#include "string.h"

using namespace std;

Message::Message(string name, string data, uint8_t* m, int l) : name(name), data(data) {
    msg_len = l;
    msg = NULL;
    if (msg_len > 65535 || msg_len < 1) {
        //cout << "No msg in message, bail initiation.\n";
        // FIXME This silently bails on messages larger than 64k
        return;
    }
    msg = (uint8_t*) malloc(msg_len);
    //printf("We got a %p message %p cpy %p len: %i\n", this, m, msg, msg_len);
    memcpy(msg, m, msg_len);
}
    
Message::~Message() {
    printf("Deconstructing: %p msg %p\n", this, msg);
    /*
    if (msg != NULL) {
        printf("freeing %p\n", msg);
        free(msg);
        msg = NULL;
        printf("freed %p\n", msg);
    }
    */
}
