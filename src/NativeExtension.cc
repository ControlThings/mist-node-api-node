#include <nan.h>
#include "MistWrapper.h"

NODE_MODULE(MistApi, MistWrapper::Init)
