answer <- pbinom(4, 15, 0.30) - pbinom(1, 15, 0.30)
stopifnot(all.equal(answer, sum(dbinom(2:4, 15, 0.30))))
answer
