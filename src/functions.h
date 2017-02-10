#pragma once

#include <nan.h>
#include "NativeExtension.h"

extern "C" {
    void mist_addon_start(char* name, int type, char* ip, uint16_t port);
    bool injectMessage(int type, uint8_t* msg, int msg_len);
    void set_evenodd(void* instance);
}

