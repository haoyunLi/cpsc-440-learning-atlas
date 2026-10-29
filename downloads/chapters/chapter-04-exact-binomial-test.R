# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: exact-binomial-test
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Course teaching counts; the null model is fixed before examining the result.
x <- 516
n <- 1218
p0 <- .5
alpha <- .05
point_mass <- dbinom(x,n,p0)
left_tail <- pbinom(x,n,p0)
two_sided <- binom.test(x,n,p=p0,alternative="two.sided")$p.value
# Probability ordering adds all outcomes no more likely than the observed one.
k <- 0:n
null_mass <- dbinom(k,n,p0)
selected <- null_mass<=point_mass*(1+1e-7)
manual_two_sided <- sum(null_mass[selected])
# Symmetry at p0 = .5 gives the matching opposite-tail boundary n - x.
reflected_tail <- pbinom(n-x-1,n,p0,lower.tail=FALSE)
print(c(sample_proportion=x/n,point_mass=point_mass,left_tail=left_tail,
        right_reflected_tail=reflected_tail,two_sided=two_sided,
        manual_two_sided=manual_two_sided,reject_at_alpha=two_sided<alpha))
# A small point mass at the null center is not evidence against the null.
center_x <- n/2
print(c(center_count=center_x,center_mass=dbinom(center_x,n,p0),
        center_p=binom.test(center_x,n,p=p0)$p.value))
stopifnot(abs(two_sided-manual_two_sided)<1e-15,
          abs(two_sided-2*left_tail)<1e-15,
          dbinom(center_x,n,p0)<alpha,
          binom.test(center_x,n,p=p0)$p.value==1)
# An asymmetric example: probability ordering and doubled smaller tails differ.
n2 <- 20
x2 <- 0
p02 <- .2
k2 <- 0:n2
mass2 <- dbinom(k2,n2,p02)
observed_mass2 <- dbinom(x2,n2,p02)
selected2 <- mass2<=observed_mass2*(1+1e-7)
manual2 <- sum(mass2[selected2])
left2 <- pbinom(x2,n2,p02)
right2 <- pbinom(x2-1,n2,p02,lower.tail=FALSE)
doubled_tail2 <- min(1,2*min(left2,right2))
helper2 <- binom.test(x2,n2,p=p02,alternative="two.sided")$p.value
print(k2[selected2])
print(c(default_two_sided=helper2,manual_two_sided=manual2,
        doubled_smaller_tail=doubled_tail2))
stopifnot(abs(manual2-helper2)<1e-12,
          abs(helper2-doubled_tail2)>1e-3)
