function compareBookmarkGroup( a, b ) {
    if ( a.name < b.name ){
      return -1;
    }
    if ( a.name > b.name ){
      return 1;
    }
    return 0;
};

String.prototype.hashCode = function() {
    var hash = 0, i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }

    hash = hash.toString().replace('-', '');

    return hash;
};

var Shuffle = function(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
};

// Randomizer
var Random = (function() {
    function Random(Seed) {
        if (!Seed) {
            Seed = this.milliseconds();
        }
        this.SeedArray = [];
        for (var i = 0; i < 56; i++)
            this.SeedArray.push(0);
        var num = (Seed == -2147483648) ? 2147483647 : Math.abs(Seed);
        var num2 = 161803398 - num;
        this.SeedArray[55] = num2;
        var num3 = 1;
        for (var i_1 = 1; i_1 < 55; i_1++) {
            var num4 = 21 * i_1 % 55;
            this.SeedArray[num4] = num3;
            num3 = num2 - num3;
            if (num3 < 0) {
                num3 += 2147483647;
            }
            num2 = this.SeedArray[num4];
        }
        for (var j = 1; j < 5; j++) {
            for (var k = 1; k < 56; k++) {
                this.SeedArray[k] -= this.SeedArray[1 + (k + 30) % 55];
                if (this.SeedArray[k] < 0) {
                    this.SeedArray[k] += 2147483647;
                }
            }
        }
        this.inext = 0;
        this.inextp = 21;
        Seed = 1;
    }
    Random.prototype.milliseconds = function() {
        var str = new Date().valueOf().toString();
        return parseInt(str.substr(str.length - 6));
    };
    Random.prototype.InternalSample = function() {
        var num = this.inext;
        var num2 = this.inextp;
        if (++num >= 56) {
            num = 1;
        }
        if (++num2 >= 56) {
            num2 = 1;
        }
        var num3 = this.SeedArray[num] - this.SeedArray[num2];
        if (num3 == 2147483647) {
            num3--;
        }
        if (num3 < 0) {
            num3 += 2147483647;
        }
        this.SeedArray[num] = num3;
        this.inext = num;
        this.inextp = num2;
        return num3;
    };
    Random.prototype.Sample = function() {
        return this.InternalSample() * 4.6566128752457969E-10;
    };
    Random.prototype.GetSampleForLargeRange = function() {
        var num = this.InternalSample();
        var flag = this.InternalSample() % 2 == 0;
        if (flag) {
            num = -num;
        }
        var num2 = num;
        num2 += 2147483646.0;
        return num2 / 4294967293.0;
    };
    Random.prototype.Next = function(minValue, maxValue) {
        if (!minValue && !maxValue)
            return this.InternalSample();
        var num = maxValue - minValue;
        if (num <= 2147483647) {
            return parseInt((this.Sample() * num + minValue).toFixed(0));
        }
        return this.GetSampleForLargeRange() * num + minValue;
    };
    Random.prototype.NextDouble = function() {
        return this.Sample();
    };
    Random.prototype.NextBytes = function(buffer) {
        for (var i = 0; i < buffer.length; i++) {
            buffer[i] = this.InternalSample() % 256;
        }
    };
    return Random;
}());