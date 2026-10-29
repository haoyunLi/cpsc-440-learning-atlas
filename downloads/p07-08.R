# Original teaching data; compare distances from each group's own median.
a <- c(0,2,2,4)
b <- c(10,14,14,18)
calculate <- function(a,b) {
  y <- c(a,b)
  g <- factor(rep(c("A","B"),c(length(a),length(b))))
  center <- ave(y,g,FUN=median)
  z <- abs(y-center)
  fit <- aov(z~g)
  tab <- summary(fit)[[1]]
  list(z=z,F=unname(tab[1,"F value"]),p=unname(tab[1,"Pr(>F)"]))
}
original <- calculate(a,b)
shifted <- calculate(a,b+100)
print(original)
print(shifted)
stopifnot(identical(original$z,shifted$z),
          isTRUE(all.equal(original$F,shifted$F)),
          isTRUE(all.equal(original$p,shifted$p)),
          abs(original$F-.6)<1e-12,
          var(b)==var(b+100))
# This algebraic invariance does not establish equal population variances.
