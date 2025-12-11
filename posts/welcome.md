# I made Garnet

There's honestly not a lot of reasons why you should bother writing a language in all honesty. It's time consuming, mentally draining, and with very little pay-off. Of course I'm not saying you *shouldn't*, but it's one of those things where you need to ask yourself "Why am I actually doing this?".
The number one reason, for me at least, was "I love Lua, but it does a number of things wrong, and doesn't have every feature I want".
I use Lua for a lot of things, mostly for building games using the LÖVE framework. Lua is a pretty neat language, but it compromises utility for speed. It can still do a lot of things, but in the grand scheme of things, it's a very small and simple language.

### Enter Garnet

So I built **Garnet**. Garnet is a cross-platform executable that can not only transpile a ruby-like syntax into Lua, but export standalone native executables in the blink of an eye. You don't need any Lua libraries, you don't even need a compiler. The executables it exports can be distributed and run without garnet even present on the system.
The whole export thing was more of an after-thought, though. The main reason I built it was to transpile a clean language back into Lua, so I get a clean, custom language, but I can still leverage the speed and performance of Lua/JIT.

Here's why I love Garnet. It turns this one liner class:

```rb
class Foo end
```

Into this Lua code:

```lua
local class = {}
class.__index = class
function class:initialize() end
function class:extend_as(name)
    local cls = {}
    cls["__call"] = class.__call
    cls.__tostring = class.__tostring
    cls.__index = cls
    cls.parent = self
    cls.__name = name or "Anonymoose"
    setmetatable(cls, self)
    return cls
end

function class:__tostring()
    if self.__is_instance then
        local mt = getmetatable(self)
        local name = mt and mt.__name or "Unknown"
        return string.format("%s#Instance: %p", name, self)
    else
        return string.format("%s#Class: %p", self.__name or "Unknown", self)
    end
end

function class:__call(...)
    local inst = setmetatable({}, self)
    inst.__is_instance = true
    inst:initialize(...)
    return inst
end

local Foo = class:extend_as("Foo")
```

The primary goal of garnet was to reduce word reptition. Here's an example of that in action:

```rb
class Foo
    def initialize
        print("Foo initialized!")
        @ready = true
        end*

let foo = Foo.new
```

You'll notice that it knew I was inside a class, so it wasn't necessary to write `Foo:initialize()`. It automatically applies the class name to methods behind the scenes.
Garnet also includes shortcuts, like `@var` which translates to `self.var`. This saves a few characters every time you want to reference an instance variable.
The asterisk after `end` causes it to close off every open block and clean states. You don't need to use it and can just keep writing `end` until you close everything off like normal.

In Lua, the above example would like this:

```lua
-- once you've written the boilerplate class implementation
local Foo = class:extend_as("Foo")
function Foo:initialize()
    print("Foo initialized!")
    self.ready = true
end

local foo = Foo() -- or Foo:initialize()
```

This doesn't look bad by any means, but Garnet cleans things up a little with a nicer structure and not needing to supply the class name in every method.