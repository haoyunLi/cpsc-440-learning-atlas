x <- 1
n <- 16
p0 <- .30
alpha <- .05
# Enumerate the probability-ordered two-sided rejection outcomes.
k <- 0:n
null_mass <- dbinom(k,n,p0)
observed_mass <- dbinom(x,n,p0)
selected <- null_mass<=observed_mass*(1+1e-7)
manual_p <- sum(null_mass[selected])
fit <- binom.test(x,n,p=p0,alternative="two.sided")
answer <- unname(fit$p.value)
left <- pbinom(x,n,p0)
right <- pbinom(x-1,n,p0,lower.tail=FALSE)
print(k[selected])
print(c(point_mass=observed_mass,left_tail=left,
        doubled_smaller_tail=min(1,2*min(left,right)),
        manual_two_sided=manual_p,answer=answer))
stopifnot(abs(manual_p-answer)<1e-12,answer>alpha,
          identical(k[selected],c(0L,1L,9:16)))
