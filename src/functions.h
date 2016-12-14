#ifndef NATIVE_EXTENSION_GRAB_H
#define NATIVE_EXTENSION_GRAB_H

#include <nan.h>
#include "NativeExtension.h"

extern "C" {
    void mist_addon_start(void);
    bool injectMessage(int type, uint8_t* msg, int msg_len);
    void set_evenodd(void* instance);
}



#endif
