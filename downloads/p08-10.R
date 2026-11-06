y <- c(10,10.2,10.3,10.4,10.5,10.9,16,
       11,11.1,11.4,11.5,11.6,11.8,16.5,
       13,13.2,13.3,13.7,13.8,14.1,19.3,
       14,14.1,14.4,14.7,14.9,15,20.4)
g <- factor(rep(LETTERS[1:4],each=7))
raw <- aov(y~g)
logged <- aov(log(y)~g)
bf <- aov(abs(y-ave(y,g,FUN=median))~g)
p <- c(raw=shapiro.test(resid(raw))$p.value,
       logged=shapiro.test(resid(logged))$p.value,
       BF=summary(bf)[[1]]$"Pr(>F)"[1])
print(p)
stopifnot(p[1]<.05,p[2]<.05,p[3]>.05)
