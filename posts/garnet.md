# I made Garnet

There's not a lot of reasons why you should bother writing a language in all honesty. It's time consuming, mentally draining, and with very little pay-off. Of course I'm not saying you *shouldn't*, but it's one of those things where you need to ask yourself "Why am I actually doing this?".
The number one reason, for me at least, was "I love Lua, but it does a number of things wrong, and doesn't have every feature I want".
I use Lua for a lot of things, mostly for building games using the [LÖVE](http://love2d.org) framework. Lua is a pretty neat language, but it compromises utility for speed. It can still do a lot of things, but in the grand scheme of things, it's a very small and simple language.

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

### String interpolation just got sexier

One thing I LOVE about Ruby is its interpolation. In lua, you can use `string.format()` or concatenate stuff together with `..`
But in Garnet, you can keep the string flowing and throw any code you want to execute inside `#{}`.
Let's take a look at some examples.

```rb
def foo (a b c)
    print("#{a} #{b} #{c}")
end

foo("hello", "there", "world!") # prints hello there world!
```

Now let's take a gander at Lua

```lua
function foo(a, b, c)
    print(a .. " " .. b .. " " .. c)
    -- alternatively, the potentially more optimized option
    -- print(string.format("%s %s %s", a, b, c))
end

foo("hello", "there", "world!")
```

In Garnet, it's nice not having to think about variable placement. You just throw them in wherever you want and make sure they are wrapped in `#{}`. You'll also notice the commas in function signatures are optional - you can just use spaces if you prefer.

### case/when - the switch statement I wish Lua had

Lua has no switch/case implementation whatsoever. Instead you rely on a series of `if/elseif` statements. Garnet employs `case/when` similar to Ruby. As a bonus, it has some neat magic patterns it can parse.

```rb
def love.keypressed(key)
    case key
    when "a|d|w|s|up|left|right|up|down"
        move(key)
    when "m"
        show_map()
    else
        print("Unknown key!")
    end
end
```

Let's take a look at that in Lua

```lua
function love.keypressed(key)
    if key == "a" or key == "d" or key == "w" or key == "s" or key == "up" or key == "left" or key == "right" or key == "up" or key == "down" then
        move(key)
    elseif key == "m" then
        show_map()
    else
        print("Unknown key")
    end
end
```

Obviously a cleaner way of performing that monstrous `if or` statement would be to throw them in a table and look it up from that, but even then, Garnet's is objectively simpler and more readable. Totally biased opinion, of course.

## Conclusion

I made garnet because I love lua, but I wanted it to behave in the way I always wanted it to. Now I have the best of both worlds - a disgustingly fast and optimized language with a fresh coat of paint. At its heart, Garnet will always be Lua, and this project would simply not exist without it.

Peace!

