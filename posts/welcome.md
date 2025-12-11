# Welcome to sadhat

Not much here. Just testing the blog system and code highlighting mmmmkay.

## Code example

Here's some <b>garnet lang</b>

```rb
extend Array as T

let t = { :foo => "bar", :baz => "faz", :nested => { :inside => true } }
let final_a = T{}
t.each_pair do |key,val|
    if type(val) != "table"
        final_a->add(val)
    else
        # contains a nested table
        val.each_pair do |k,v|
            final_a->add(tostring(v))
            end*

final_a->sort()

final_a.each {|val| print(val)}
let faz_idx = final_a->find("faz") # find the index of "faz"
if faz_idx
    # if index found, remove it from final_a table
    final_a->del(faz_idx)
end
let str = final_a->join(",") # create a string of fine_a elements using a comma as seperator
print(str) # print the final table as the new string
```
