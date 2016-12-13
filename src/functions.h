#ifndef NATIVE_EXTENSION_GRAB_H
#define NATIVE_EXTENSION_GRAB_H

#include <nan.h>
#include "NativeExtension.h"

// Example top-level functions. These functions demonstrate how to return various js types.
// Implementations are in functions.cc

NAN_METHOD(nothing);
NAN_METHOD(aString);
NAN_METHOD(aBoolean);
NAN_METHOD(aNumber);
NAN_METHOD(anObject);
NAN_METHOD(anArray);
NAN_METHOD(callback);

NAN_METHOD(mistApp);

extern "C" {
    bool injectMessage(uint8_t* msg, int msg_len);
    void kill_and_join(void* args);
    void set_evenodd(void* instance);
}



#endif
