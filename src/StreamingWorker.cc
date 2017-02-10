#include "StreamingWorker.h"
#include <iostream>

using namespace Nan;

StreamingWorker::StreamingWorker(Callback *progress, Callback *callback, Callback *error_callback)
: AsyncProgressWorker(callback), progress(progress), error_callback(error_callback) {
    input_closed = false;
}

StreamingWorker::~StreamingWorker() {
    delete progress;
    delete error_callback;
}

void
StreamingWorker::HandleErrorCallback() {
    HandleScope scope;

    v8::Local<v8::Value> argv[] = {
        v8::Exception::Error(New<v8::String>(ErrorMessage()).ToLocalChecked())
    };
    error_callback->Call(1, argv);
}

void
StreamingWorker::HandleOKCallback() {
    drainQueue();
    callback->Call(0, NULL);
}

void
StreamingWorker::HandleProgressCallback(const char *data, size_t size) {
    drainQueue();
}

void
StreamingWorker::close() {
    input_closed = true;
}

void
StreamingWorker::writeToNode(const AsyncProgressWorker::ExecutionProgress& progress, Message & msg) {
    toNode.write(msg);
    progress.Send(reinterpret_cast<const char*> (&toNode), sizeof (toNode));
}

bool
StreamingWorker::closed() {
    return input_closed;
}

void
StreamingWorker::drainQueue() {
    HandleScope scope;

    //printf("drain queue...\n");

    // drain the queue - since we might only get called once for many writes
    std::deque<Message> contents;
    toNode.readAll(contents);

    for (Message & msg : contents) {
        v8::Local<v8::Value> argv[] = {
            New<v8::String>(msg.name.c_str()).ToLocalChecked(),
            New<v8::String>(msg.data.c_str()).ToLocalChecked(),
            Nan::NewBuffer((char*) msg.msg, (uint32_t) msg.msg_len).ToLocalChecked()
        };
        progress->Call(3, argv);
    }
}

