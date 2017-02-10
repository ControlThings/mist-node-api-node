#include <iostream>
#include <string>
#include <algorithm>
#include <iterator>
#include <nan.h>
#include <node.h>
#include <iostream>
#include <thread>

#include <cstdio>

#include <stdlib.h>
#include <string.h>

#include "NativeExtension.h"
#include "StreamingWorker.h"
#include "StreamingWorkerWrapper.h"
#include "PCQueue.h"
#include "Message.h"
#include "Mist.h"
#include "functions.h"

StreamingWorker * create_worker(Nan::Callback *data, Nan::Callback *complete, Nan::Callback *error_callback, v8::Local<v8::Object> & options) {
    return new Mist(data, complete, error_callback, options);
}

NODE_MODULE(MistApi, StreamingWorkerWrapper::Init)
